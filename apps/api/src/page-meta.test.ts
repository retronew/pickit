import { describe, expect, it } from "vitest";
import { parsePageMeta } from "#page-meta";

describe("parsePageMeta", () => {
  it("reads title, description, favicon and og:image, resolving relative URLs", () => {
    const html = `<html><head>
      <title> Example </title>
      <meta content="A site" name="description">
      <link rel="shortcut icon" href="/fav.png">
      <meta property="og:image" content="/cover.jpg">
    </head></html>`;
    expect(parsePageMeta(html, "https://ex.com/a/b")).toEqual({
      title: "Example",
      description: "A site",
      icon: "https://ex.com/fav.png",
      image: "https://ex.com/cover.jpg",
    });
  });

  it("falls back to twitter:image and the default favicon", () => {
    const html = `<meta name="twitter:image" content="https://cdn.ex.com/t.png">`;
    const meta = parsePageMeta(html, "https://ex.com/");
    expect(meta.image).toBe("https://cdn.ex.com/t.png");
    expect(meta.icon).toBe("https://ex.com/favicon.ico");
  });

  it("ignores non-http image URLs", () => {
    const html = `<meta property="og:image" content="data:image/png;base64,xx">`;
    expect(parsePageMeta(html, "https://ex.com/").image).toBe("");
  });
});
