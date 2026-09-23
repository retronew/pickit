import { describe, expect, it } from "vitest";
import { cosSim } from "./ai";

describe("cosSim", () => {
  it("returns 1 for identical vectors", () => {
    const v = new Float32Array([1, 2, 3]);
    expect(cosSim(v, v)).toBeCloseTo(1, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosSim(a, b)).toBeCloseTo(0, 5);
  });

  it("returns -1 for opposite vectors", () => {
    const a = new Float32Array([1, 2]);
    const b = new Float32Array([-1, -2]);
    expect(cosSim(a, b)).toBeCloseTo(-1, 5);
  });

  it("does not divide by zero for a zero vector", () => {
    const zero = new Float32Array([0, 0, 0]);
    const other = new Float32Array([1, 2, 3]);
    expect(Number.isFinite(cosSim(zero, other))).toBe(true);
  });
});
