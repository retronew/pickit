import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, type TestApp } from "../../test/app";
import { createMemoryR2 } from "../../test/r2";
import { backfillContent } from "#item-content";
import type { Env } from "#types";

let t: TestApp;
let r2: ReturnType<typeof createMemoryR2>;
/** What the fake web serves, by URL. */
let pages: Record<string, { status?: number; html: string }>;

beforeEach(async () => {
  r2 = createMemoryR2();
  t = await createTestApp({ BACKUPS: r2.bucket });
  pages = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const page = pages[String(input)];
      if (!page) throw new Error("offline");
      return new Response(page.html, { status: page.status ?? 200, headers: { "Content-Type": "text/html" } });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

const create = async (url: string) => (await t.json("/api/items", { json: { name: "A", url } }, 201)).id as number;

describe("page text snapshots", () => {
  it("captures a new bookmark's text into R2", async () => {
    pages["https://a.dev/"] = { html: "<body><nav>x</nav><article><h1>Hello</h1><p>World</p></article></body>" };
    const id = await create("https://a.dev/");
    expect(r2.objects.get(`content/${id}.txt`)?.body).toBe("Hello\n\nWorld");

    // Status only by default; the text on request.
    expect(await t.json(`/api/items/${id}/content`)).toMatchObject({ enabled: true, status: "ok", size: 12, text: null });
    expect((await t.json(`/api/items/${id}/content?text=1`)).text).toBe("Hello\n\nWorld");
    expect((await t.json(`/api/items/${id}`)).contentStatus).toBe("ok");
  });

  it("keeps the old snapshot when a refetch fails, and replaces it when it works", async () => {
    pages["https://a.dev/"] = { html: "<p>v1</p>" };
    const id = await create("https://a.dev/");
    pages["https://a.dev/"] = { status: 500, html: "down" };
    expect(await t.json(`/api/items/${id}/content`, { json: {} })).toMatchObject({ status: "ok", text: "v1" });

    pages["https://a.dev/"] = { html: "<p>v2</p>" };
    expect(await t.json(`/api/items/${id}/content`, { json: {} })).toMatchObject({ status: "ok", text: "v2" });
  });

  it("marks pages without text, and deletes the text on purge", async () => {
    pages["https://empty.dev/"] = { html: "<body><script>app()</script></body>" };
    const empty = await create("https://empty.dev/");
    expect(await t.json(`/api/items/${empty}/content`)).toMatchObject({ status: "empty", text: null });

    pages["https://a.dev/"] = { html: "<p>text</p>" };
    const id = await create("https://a.dev/");
    await t.json(`/api/items/${id}`, { method: "DELETE" });
    await t.json(`/api/items/${id}/purge`, { method: "DELETE" });
    expect(r2.objects.has(`content/${id}.txt`)).toBe(false);
  });

  it("backfills older bookmarks and is off without R2", async () => {
    const plain = await createTestApp();
    const id = (await plain.json("/api/items", { json: { name: "A", url: "https://a.dev/" } }, 201)).id;
    expect(await plain.json(`/api/items/${id}/content`)).toMatchObject({ enabled: false, status: "" });
    await plain.json(`/api/items/${id}/content`, { json: {} }, 400);

    // The same database, now with R2: the cron picks the item up.
    pages["https://a.dev/"] = { html: "<p>later</p>" };
    const env = { DB: plain.env.DB, BACKUPS: r2.bucket } as Env;
    expect(await backfillContent(env)).toBe(1);
    expect(r2.objects.get(`content/${id}.txt`)?.body).toBe("later");
    expect(await backfillContent(env)).toBe(0);
  });
});
