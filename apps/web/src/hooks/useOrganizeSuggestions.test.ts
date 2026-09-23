import { describe, expect, it } from "vitest";
import { isChange, sameTags, type SuggestionRow } from "./useOrganizeSuggestions";

const row = (patch: Partial<SuggestionRow>): SuggestionRow => ({
  id: 1,
  name: "A",
  url: "",
  category: "前端",
  tags: ["a", "b"],
  ...patch,
});

describe("organize suggestions", () => {
  it("compares tags ignoring order", () => {
    expect(sameTags(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameTags(["a"], ["a", "b"])).toBe(false);
  });

  it("only counts suggestions that change something", () => {
    expect(isChange(row({ suggested: { category: "前端", tags: ["b", "a"] } }))).toBe(false);
    expect(isChange(row({ suggested: { category: "后端", tags: ["a", "b"] } }))).toBe(true);
    expect(isChange(row({ suggested: { category: "前端", tags: ["a"] } }))).toBe(true);
    expect(isChange(row({ error: "boom" }))).toBe(false);
  });
});
