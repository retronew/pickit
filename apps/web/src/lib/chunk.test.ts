import { describe, expect, it } from "vitest";
import { chunk } from "#lib/chunk";

describe("chunk", () => {
  it("splits into runs of `size`, last one shorter", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
