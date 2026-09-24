import { describe, expect, it } from "vitest";
import { formatBytes, formatRelative } from "./format";

describe("formatBytes", () => {
  it("picks a unit and keeps one decimal below 10", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(20 * 1024)).toBe("20 KB");
    expect(formatBytes(11.5 * 1024 * 1024)).toBe("12 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });
});

describe("formatRelative", () => {
  const now = Date.UTC(2026, 8, 24, 12);
  it("picks the largest whole unit", () => {
    const at = (ms: number) => formatRelative(now - ms, now);
    expect(at(10_000)).toBe(formatRelative(now, now));
    expect(at(5 * 60_000)).toMatch(/5/);
    expect(at(3 * 3600_000)).toMatch(/3/);
    expect(at(2 * 86400_000)).not.toBe(at(2 * 3600_000));
  });
});
