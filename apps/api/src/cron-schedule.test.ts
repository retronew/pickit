import { describe, expect, it } from "vitest";
import { nextRun } from "./cron-schedule";

const at = (iso: string) => Date.parse(iso);
const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

describe("nextRun", () => {
  it("runs every minute on the next whole minute", () => {
    expect(iso(nextRun("* * * * *", at("2026-09-24T10:15:30Z")))).toBe("2026-09-24T10:16:00.000Z");
    expect(iso(nextRun("* * * * *", at("2026-09-24T10:15:00Z")))).toBe("2026-09-24T10:16:00.000Z");
  });

  it("finds the daily slot today or tomorrow, in UTC", () => {
    expect(iso(nextRun("0 18 * * *", at("2026-09-24T10:00:00Z")))).toBe("2026-09-24T18:00:00.000Z");
    expect(iso(nextRun("0 18 * * *", at("2026-09-24T18:00:00Z")))).toBe("2026-09-25T18:00:00.000Z");
    expect(iso(nextRun("0 18 * * *", at("2026-12-31T19:00:00Z")))).toBe("2027-01-01T18:00:00.000Z");
  });

  it("handles steps, lists, ranges and weekdays", () => {
    expect(iso(nextRun("*/15 * * * *", at("2026-09-24T10:16:00Z")))).toBe("2026-09-24T10:30:00.000Z");
    expect(iso(nextRun("0 9,21 * * *", at("2026-09-24T10:00:00Z")))).toBe("2026-09-24T21:00:00.000Z");
    // 2026-09-24 is a Thursday; next Monday 08:00.
    expect(iso(nextRun("0 8 * * 1", at("2026-09-24T10:00:00Z")))).toBe("2026-09-28T08:00:00.000Z");
    expect(iso(nextRun("30 6 1 * *", at("2026-09-24T10:00:00Z")))).toBe("2026-10-01T06:30:00.000Z");
  });

  it("rejects malformed expressions", () => {
    expect(() => nextRun("* * *", 0)).toThrow();
    expect(() => nextRun("x * * * *", 0)).toThrow();
  });
});
