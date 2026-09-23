import { describe, expect, it } from "vitest";
import { ftsQuery } from "./search";

describe("ftsQuery", () => {
  it("wraps each term in quotes and joins with OR", () => {
    expect(ftsQuery("react vue")).toBe('"react" OR "vue"');
  });

  it("collapses extra whitespace between terms", () => {
    expect(ftsQuery("  react   vue  ")).toBe('"react" OR "vue"');
  });

  it("strips embedded double quotes so a term can't break the MATCH syntax", () => {
    expect(ftsQuery('react"')).toBe('"react"');
  });

  it("handles a single term", () => {
    expect(ftsQuery("react")).toBe('"react"');
  });
});
