import { describe, expect, it } from "vitest";
import { matchesState } from "#hooks/useSavedSearchBinding";

const saved = { id: "1", name: "n", query: "llm", category: "AI", tags: ["a", "b"], sort: "created" as const };

describe("matchesState", () => {
  it("matches regardless of tag order and query whitespace", () => {
    expect(matchesState(saved, { query: " llm ", category: "AI", tags: ["b", "a"], sort: "created" })).toBe(true);
  });
  it("differs on any field", () => {
    expect(matchesState(saved, { query: "llm", category: "AI", tags: ["a"], sort: "created" })).toBe(false);
    expect(matchesState(saved, { query: "llm", category: "", tags: ["a", "b"], sort: "created" })).toBe(false);
    expect(matchesState(saved, { query: "llm", category: "AI", tags: ["a", "b"], sort: "name" })).toBe(false);
  });
});
