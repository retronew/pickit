import { describe, expect, it } from "vitest";
import { hostnameOf, parseBatchUrls } from "#lib/batch-urls";

describe("parseBatchUrls", () => {
  it("keeps trimmed http(s) lines, dropping blanks, junk and duplicates", () => {
    const text = "https://a.com\r\n  https://b.com  \n\nnot a url\nftp://c.com\nhttps://a.com\nhttp://d.com/x y";
    expect(parseBatchUrls(text)).toEqual(["https://a.com", "https://b.com"]);
  });
});

describe("hostnameOf", () => {
  it("returns the hostname, or the input when it isn't a URL", () => {
    expect(hostnameOf("https://github.com/a/b")).toBe("github.com");
    expect(hostnameOf("nope")).toBe("nope");
  });
});
