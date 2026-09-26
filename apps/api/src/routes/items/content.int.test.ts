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

  it("retries a failed capture after 1, 3 and 7 days, then stops", async () => {
    pages["https://down.dev/"] = { status: 500, html: "down" };
    const id = await create("https://down.dev/");
    const row = () => t.db.prepare("SELECT content_status, content_attempts, content_due_at FROM items WHERE id = ?").bind(id).first<{
      content_status: string;
      content_attempts: number;
      content_due_at: number | null;
    }>();
    expect(await row()).toMatchObject({ content_status: "failed", content_attempts: 1 });

    // Not due yet: the backfill leaves it alone.
    expect(await backfillContent(t.env)).toBe(0);

    const DAY = 86_400_000;
    for (const [attempts, days] of [[2, 3], [3, 7]] as const) {
      await t.db.prepare("UPDATE items SET content_due_at = ? WHERE id = ?").bind(Date.now() - 1, id).run();
      expect(await backfillContent(t.env)).toBe(1);
      const r = (await row())!;
      expect(r.content_attempts).toBe(attempts);
      expect(r.content_due_at! - Date.now()).toBeGreaterThan(days * DAY - 60_000);
    }
    await t.db.prepare("UPDATE items SET content_due_at = ? WHERE id = ?").bind(Date.now() - 1, id).run();
    await backfillContent(t.env);
    expect(await row()).toMatchObject({ content_attempts: 4, content_due_at: null });

    // Once the page is back, a retry captures it and resets the count.
    pages["https://down.dev/"] = { html: "<p>back</p>" };
    await t.db.prepare("UPDATE items SET content_due_at = ? WHERE id = ?").bind(Date.now() - 1, id).run();
    expect(await backfillContent(t.env)).toBe(1);
    expect(await row()).toMatchObject({ content_status: "ok", content_attempts: 0, content_due_at: null });
  });

  it("recaptures all bookmarks through the backfill", async () => {
    pages["https://a.dev/"] = { html: "<p>v1</p>" };
    const id = await create("https://a.dev/");
    pages["https://a.dev/"] = { html: "<p>v2</p>" };
    expect(await t.json("/api/items/content/recapture-all", { json: {} })).toEqual({ scheduled: 1 });
    expect(await backfillContent(t.env)).toBe(1);
    expect(r2.objects.get(`content/${id}.txt`)?.body).toBe("v2");
    expect(await backfillContent(t.env)).toBe(0);
  });

  it("captures the new page when a bookmark's URL changes", async () => {
    pages["https://a.dev/"] = { html: "<p>old page</p>" };
    pages["https://b.dev/"] = { html: "<p>new page</p>" };
    const id = await create("https://a.dev/");
    await t.json(`/api/items/${id}`, { method: "PUT", json: { url: "https://b.dev/" } });
    expect(r2.objects.get(`content/${id}.txt`)?.body).toBe("new page");
  });

  it("upgrades old plain-text snapshots to Markdown once Browser Rendering is on", async () => {
    pages["https://a.dev/"] = { html: "<p>plain</p>" };
    const id = await create("https://a.dev/");
    // Browser Rendering off: nothing to upgrade.
    expect(await backfillContent(t.env)).toBe(0);

    const quickAction = vi.fn(async () =>
      Response.json({ success: true, result: "# Plain" }, { headers: { "X-Browser-Ms-Used": "1000" } }),
    );
    t.env.BROWSER = { quickAction } as unknown as BrowserRun;
    await t.json("/api/settings/browser-render", { method: "PUT", json: { enabled: true, plan: "paid", limitMinutes: 540 } });
    expect(await backfillContent(t.env)).toBe(1);
    expect(r2.objects.get(`content/${id}.txt`)?.body).toBe("# Plain");
    // Upgraded once, not again.
    expect(await backfillContent(t.env)).toBe(0);
    expect(quickAction).toHaveBeenCalledTimes(1);
  });
});
