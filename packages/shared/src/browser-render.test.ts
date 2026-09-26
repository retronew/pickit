import { describe, expect, it } from "vitest";
import { clampBrowserLimit, sanitizeBrowserRenderSettings } from "./browser-render";

describe("browser render settings", () => {
  it("never lets the free plan exceed its daily quota", () => {
    expect(clampBrowserLimit("free", 30)).toBe(10);
    expect(clampBrowserLimit("free", 0)).toBe(1);
    expect(clampBrowserLimit("paid", 900)).toBe(900);
    expect(clampBrowserLimit("paid", Number.NaN)).toBe(540);
  });

  it("falls back to defaults for bad input", () => {
    expect(sanitizeBrowserRenderSettings(null)).toEqual({ enabled: false, plan: "free", limitMinutes: 8 });
    expect(sanitizeBrowserRenderSettings({ enabled: true, plan: "paid", accountId: "old", limitMinutes: "x" })).toEqual({
      enabled: true,
      plan: "paid",
      limitMinutes: 540,
    });
  });
});
