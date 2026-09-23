import { describe, expect, it } from "vitest";
import { normalizeUrl } from "./index";

describe("normalizeUrl", () => {
  it("strips protocol, lowercases, and drops trailing slashes", () => {
    expect(normalizeUrl("https://Example.com/Path/")).toBe("example.com/path");
    expect(normalizeUrl("http://example.com")).toBe("example.com");
    expect(normalizeUrl("https://example.com///")).toBe("example.com");
  });

  it("treats http and https as equivalent", () => {
    expect(normalizeUrl("http://example.com/a")).toBe(
      normalizeUrl("https://example.com/a"),
    );
  });

  it("returns empty string for empty input", () => {
    expect(normalizeUrl("")).toBe("");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeUrl("  https://example.com  ")).toBe("example.com");
  });
});
