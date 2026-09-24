import { describe, expect, it } from "vitest";
import { extractText, MAX_TEXT } from "./page-text";

describe("extractText", () => {
  it("keeps the article and drops page chrome", () => {
    const html = `<html><head><title>T</title><style>.a{}</style></head><body>
      <header>Site header</header><nav><a>Home</a></nav>
      <article><h1>Title &amp; more</h1><p>First   paragraph.</p><script>alert(1)</script>
      <ul><li>One</li><li>Two</li></ul><p>Caf&eacute;? &#x4E2D;&#25991; &nbsp;done</p></article>
      <aside>Related</aside><footer>© 2026</footer></body></html>`;
    expect(extractText(html)).toBe("Title & more\n\nFirst paragraph.\n\nOne\n\nTwo\n\nCaf&eacute;? 中文 done");
  });

  it("falls back to main, then body", () => {
    expect(extractText("<body><div>Menu</div><main><p>Main text</p></main></body>")).toBe("Main text");
    expect(extractText("<body><p>Just body</p><!-- note --></body>")).toBe("Just body");
  });

  it("returns nothing for pages without readable text, and caps long text", () => {
    expect(extractText("<html><body><script>app()</script></body></html>")).toBe("");
    expect(extractText(`<body><p>${"x".repeat(MAX_TEXT + 100)}</p></body>`)).toHaveLength(MAX_TEXT);
  });
});
