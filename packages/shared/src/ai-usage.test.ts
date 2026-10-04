import { describe, expect, it } from "vitest";
import { bucketByDay, emptyTotals, localDay, recentDays, startOfLocalDay } from "./ai-usage";

describe("localDay / startOfLocalDay", () => {
  it("uses the zone's date, not UTC", () => {
    const t = Date.UTC(2026, 9, 3, 17, 0); // 01:00 on Oct 4 in Shanghai
    expect(localDay(t, "UTC")).toBe("2026-10-03");
    expect(localDay(t, "Asia/Shanghai")).toBe("2026-10-04");
  });

  it("handles 45-minute zones", () => {
    expect(startOfLocalDay("2026-10-04", "Asia/Kathmandu")).toBe(Date.UTC(2026, 9, 3, 18, 15));
  });

  it("handles days next to a DST switch", () => {
    // New York: EDT (-4) until Nov 1 2026 02:00, EST (-5) after.
    expect(startOfLocalDay("2026-11-01", "America/New_York")).toBe(Date.UTC(2026, 10, 1, 4));
    expect(startOfLocalDay("2026-11-02", "America/New_York")).toBe(Date.UTC(2026, 10, 2, 5));
    expect(localDay(Date.UTC(2026, 10, 2, 4, 30), "America/New_York")).toBe("2026-11-01");
  });
});

describe("recentDays / bucketByDay", () => {
  it("lists local days and fills gaps", () => {
    const now = Date.UTC(2026, 9, 3, 17, 0);
    const days = recentDays(3, "Asia/Shanghai", now);
    expect(days).toEqual(["2026-10-02", "2026-10-03", "2026-10-04"]);
    const rows = bucketByDay(
      [{ at: now, ...emptyTotals(), calls: 2, inputTokens: 10 }],
      days,
      "Asia/Shanghai",
    );
    expect(rows.map((r) => r.calls)).toEqual([0, 0, 2]);
    expect(rows[2].inputTokens).toBe(10);
  });
});
