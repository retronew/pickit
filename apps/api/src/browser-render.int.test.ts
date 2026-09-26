import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, type TestApp } from "./test/app";
import {
  acquireBrowser,
  readUsageMs,
  renderMarkdown,
  saveBrowserRenderSettings,
  setBrowserRenderToken,
  tidyMarkdown,
  usagePeriod,
} from "#browser-render";

let t: TestApp;
const NOON = Date.UTC(2026, 8, 26, 12);

beforeEach(async () => {
  t = await createTestApp();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function enable(plan: "free" | "paid", limitMinutes: number) {
  await saveBrowserRenderSettings(t.env.DB, { enabled: true, plan, accountId: "acc", limitMinutes });
  await setBrowserRenderToken(t.env.DB, "cf-token-1234");
}

describe("usagePeriod", () => {
  it("counts per UTC day on the free plan and per UTC month on paid", () => {
    expect(usagePeriod("free", NOON)).toEqual({ key: "browser_usage:d:2026-09-26", resetsAt: Date.UTC(2026, 8, 27) });
    expect(usagePeriod("paid", NOON)).toEqual({ key: "browser_usage:m:2026-09", resetsAt: Date.UTC(2026, 9, 1) });
  });
});

describe("tidyMarkdown", () => {
  it("drops front matter and makes links absolute", () => {
    const md = '---\ntitle: "T"\n---\n\n# Title\n\n[a](/x) ![i](img.png) [b](https://o.com) [c](#top)\n\n\n\nEnd';
    expect(tidyMarkdown(md, "https://site.com/post/1")).toBe(
      "# Title\n\n[a](https://site.com/x) ![i](https://site.com/post/img.png) [b](https://o.com) [c](#top)\n\nEnd",
    );
  });
});

describe("acquireBrowser", () => {
  it("is off until enabled with an account and a token", async () => {
    expect(await acquireBrowser(t.env.DB, NOON)).toEqual({ ok: false, reason: "off" });
    await saveBrowserRenderSettings(t.env.DB, { enabled: true, plan: "free", accountId: "acc", limitMinutes: 8 });
    expect(await acquireBrowser(t.env.DB, NOON)).toEqual({ ok: false, reason: "off" });
  });

  it("allows one render per 10 seconds on the free plan", async () => {
    await enable("free", 8);
    expect((await acquireBrowser(t.env.DB, NOON)).ok).toBe(true);
    expect(await acquireBrowser(t.env.DB, NOON + 5_000)).toEqual({ ok: false, reason: "throttled" });
    expect((await acquireBrowser(t.env.DB, NOON + 10_000)).ok).toBe(true);
  });

  it("doesn't throttle the paid plan", async () => {
    await enable("paid", 540);
    expect((await acquireBrowser(t.env.DB, NOON)).ok).toBe(true);
    expect((await acquireBrowser(t.env.DB, NOON)).ok).toBe(true);
  });
});

describe("renderMarkdown", () => {
  it("records the reported browser time and stops at the limit", async () => {
    await enable("paid", 1);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: true, result: "# Hi" }, { headers: { "X-Browser-Ms-Used": "45000" } })),
    );
    const access = await acquireBrowser(t.env.DB);
    if (!access.ok) throw new Error("expected access");
    expect(await renderMarkdown(t.env.DB, access, { url: "https://site.com" })).toEqual({ ok: true, markdown: "# Hi" });
    expect(await readUsageMs(t.env.DB, "paid")).toBe(45_000);
    await renderMarkdown(t.env.DB, access, { url: "https://site.com" });
    expect(await acquireBrowser(t.env.DB)).toEqual({ ok: false, reason: "budget" });
  });

  it("treats Cloudflare's time-limit error as the limit being used up", async () => {
    await enable("free", 8);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: false, errors: [{ message: "Browser time limit exceeded for today" }] }, { status: 429 })),
    );
    const access = await acquireBrowser(t.env.DB);
    if (!access.ok) throw new Error("expected access");
    expect((await renderMarkdown(t.env.DB, access, { url: "https://site.com" })).ok).toBe(false);
    expect(await readUsageMs(t.env.DB, "free")).toBe(8 * 60_000);
  });
});
