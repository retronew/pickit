import { describe, expect, it } from "vitest";
import { fillMonths } from "#lib/fillMonths";

const now = new Date(2026, 8, 15); // 2026-09

describe("fillMonths", () => {
  it("pads a single month out to the last 12 months", () => {
    const out = fillMonths([{ month: "2026-09", count: 5 }], now);
    expect(out).toHaveLength(12);
    expect(out[0]).toEqual({ month: "2025-10", count: 0 });
    expect(out.at(-1)).toEqual({ month: "2026-09", count: 5 });
  });

  it("starts at the first month when it is older than a year", () => {
    const out = fillMonths([{ month: "2024-12", count: 1 }, { month: "2026-02", count: 3 }], now);
    expect(out[0]).toEqual({ month: "2024-12", count: 1 });
    expect(out.find((r) => r.month === "2025-06")).toEqual({ month: "2025-06", count: 0 });
    expect(out.at(-1)?.month).toBe("2026-09");
  });
});
