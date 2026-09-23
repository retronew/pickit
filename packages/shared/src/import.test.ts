import { describe, expect, it } from "vitest";
import { parseMarkdownTables, parseBookmarksHtml, parseJsonItems } from "./import";

describe("parseMarkdownTables", () => {
  it("reads category headings and table rows", () => {
    const md = `
## 3D

| 名称 | 链接 | 备注 |
| --- | --- | --- |
| TresJS | https://tresjs.org | Vue 的 3D 框架 |
| threlte | https://threlte.xyz | Svelte 的 3D 框架 |

## CSS
| 名称 | 链接 | 备注 |
| --- | --- | --- |
| Tailwind | https://tailwindcss.com |  |
`;
    const rows = parseMarkdownTables(md);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      name: "TresJS",
      url: "https://tresjs.org",
      note: "Vue 的 3D 框架",
      category: "3D",
    });
    expect(rows[2].category).toBe("CSS");
  });

  it("drops rows with a non-http url and rows with no name", () => {
    const md = `
分类
| 名称 | 链接 | 备注 |
| --- | --- | --- |
| No URL | not-a-url | |
|  | https://example.com | 没有名称 |
`;
    const rows = parseMarkdownTables(md);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("No URL");
    expect(rows[0].url).toBe("");
  });

  it("returns nothing for content with no tables", () => {
    expect(parseMarkdownTables("just some text\nno tables here")).toEqual([]);
  });
});

describe("parseBookmarksHtml", () => {
  it("assigns the nearest preceding H3 as category", () => {
    const html = `
<DL><p>
  <DT><H3>浏览器</H3>
  <DL><p>
    <DT><A HREF="https://example.com/a">A站</A>
    <DT><A HREF="https://example.com/b">B站</A>
  </DL><p>
  <DT><H3>工具</H3>
  <DL><p>
    <DT><A HREF="https://example.com/c">C站</A>
  </DL><p>
</DL><p>
`;
    const rows = parseBookmarksHtml(html);
    expect(rows).toEqual([
      { name: "A站", url: "https://example.com/a", note: "", category: "浏览器" },
      { name: "B站", url: "https://example.com/b", note: "", category: "浏览器" },
      { name: "C站", url: "https://example.com/c", note: "", category: "工具" },
    ]);
  });

  it("decodes HTML entities in link text", () => {
    const html = `<DT><A HREF="https://example.com">A &amp; B</A>`;
    const rows = parseBookmarksHtml(html);
    expect(rows[0].name).toBe("A & B");
  });

  it("skips non-http hrefs", () => {
    const html = `<DT><A HREF="javascript:void(0)">bad</A>`;
    expect(parseBookmarksHtml(html)).toEqual([]);
  });
});

describe("parseJsonItems", () => {
  it("parses a flat array export", () => {
    const json = JSON.stringify([
      { name: "A", url: "https://a.com", note: "n", category: "c", tags: ["x"] },
    ]);
    expect(parseJsonItems(json)).toEqual([
      { name: "A", url: "https://a.com", note: "n", category: "c", tags: ["x"], icon: undefined },
    ]);
  });

  it("parses a { items: [...] } wrapper", () => {
    const json = JSON.stringify({ items: [{ name: "A", url: "" }] });
    const rows = parseJsonItems(json);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("A");
  });

  it("skips entries without a name", () => {
    const json = JSON.stringify([{ url: "https://a.com" }, { name: "B" }]);
    expect(parseJsonItems(json)).toHaveLength(1);
  });
});
