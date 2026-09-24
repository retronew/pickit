import { describe, expect, it } from "vitest";
import { MAX_SAVED_SEARCHES, sanitizeSavedSearches } from "./saved-searches";

describe("sanitizeSavedSearches", () => {
  it("normalizes valid entries and drops malformed ones", () => {
    expect(
      sanitizeSavedSearches([
        { id: "a", name: "  AI  ", query: " llm ", category: "AI", tags: ["x", "x", "", 3], sort: "created" },
        { id: "b", name: "" },
        { id: "a", name: "dup id" },
        null,
        "junk",
        { id: "c", name: "Odd sort", sort: "random" },
      ]),
    ).toEqual([
      { id: "a", name: "AI", query: "llm", category: "AI", tags: ["x"], sort: "created" },
      { id: "c", name: "Odd sort", query: "", category: "", tags: [], sort: "pinned" },
    ]);
  });

  it("returns [] for non-arrays and caps the count", () => {
    expect(sanitizeSavedSearches({})).toEqual([]);
    const many = Array.from({ length: 50 }, (_, i) => ({ id: String(i), name: `n${i}` }));
    expect(sanitizeSavedSearches(many)).toHaveLength(MAX_SAVED_SEARCHES);
  });
});
