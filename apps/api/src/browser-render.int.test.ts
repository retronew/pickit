import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, type TestApp } from "./test/app";
import {
  acquireBrowser,
  readUsageMs,
  renderMarkdown,
  saveBrowserRenderSettings,
  tidyMarkdown,
  usagePeriod,
} from "#browser-render";

let t: TestApp;
const NOON = Date.UTC(2026, 8, 26, 12);

beforeEach(async () => {
  t = await createTestApp();
});

/** A BROWSER binding whose markdown quick action answers with `response`. */
function bindBrowser(response: () => Response) {
  const quickAction = vi.fn(async () => response());
  t.env.BROWSER = { quickAction } as unknown as BrowserRun;
  return quickAction;
}

async function enable(plan: "free" | "paid", limitMinutes: number) {
  await saveBrowserRenderSettings(t.env.DB, { enabled: true, plan, limitMinutes });
  if (!t.env.BROWSER) bindBrowser(() => Response.json({ success: true, result: "" }));
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
  it("is off until enabled, and without the BROWSER binding", async () => {
    bindBrowser(() => Response.json({ success: true, result: "" }));
    expect(await acquireBrowser(t.env, NOON)).toEqual({ ok: false, reason: "off" });
    await saveBrowserRenderSettings(t.env.DB, { enabled: true, plan: "free", limitMinutes: 8 });
    t.env.BROWSER = undefined;
    expect(await acquireBrowser(t.env, NOON)).toEqual({ ok: false, reason: "off" });
  });

  it("allows one render per 10 seconds on the free plan", async () => {
    await enable("free", 8);
    expect((await acquireBrowser(t.env, NOON)).ok).toBe(true);
    expect(await acquireBrowser(t.env, NOON + 5_000)).toEqual({ ok: false, reason: "throttled" });
    expect((await acquireBrowser(t.env, NOON + 10_000)).ok).toBe(true);
  });

  it("doesn't throttle the paid plan", async () => {
    await enable("paid", 540);
    expect((await acquireBrowser(t.env, NOON)).ok).toBe(true);
    expect((await acquireBrowser(t.env, NOON)).ok).toBe(true);
  });
});

describe("renderMarkdown", () => {
  it("records the reported browser time and stops at the limit", async () => {
    await enable("paid", 1);
    const quickAction = bindBrowser(() =>
      Response.json({ success: true, result: "# Hi" }, { headers: { "X-Browser-Ms-Used": "45000" } }),
    );
    const access = await acquireBrowser(t.env);
    if (!access.ok) throw new Error("expected access");
    expect(await renderMarkdown(t.env.DB, access, { url: "https://site.com" })).toEqual({ ok: true, markdown: "# Hi" });
    expect(quickAction).toHaveBeenCalledWith("markdown", expect.objectContaining({ url: "https://site.com" }));
    expect(await readUsageMs(t.env.DB, "paid")).toBe(45_000);
    await renderMarkdown(t.env.DB, access, { url: "https://site.com" });
    expect(await acquireBrowser(t.env)).toEqual({ ok: false, reason: "budget" });
  });

  it("treats Cloudflare's time-limit error as the limit being used up", async () => {
    await enable("free", 8);
    bindBrowser(() =>
      Response.json({ success: false, errors: [{ message: "Browser time limit exceeded for today" }] }, { status: 429 }),
    );
    const access = await acquireBrowser(t.env);
    if (!access.ok) throw new Error("expected access");
    expect((await renderMarkdown(t.env.DB, access, { url: "https://site.com" })).ok).toBe(false);
    expect(await readUsageMs(t.env.DB, "free")).toBe(8 * 60_000);
  });
});
