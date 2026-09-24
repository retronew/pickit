import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../test/app";

let t: TestApp;

async function create(item: Record<string, unknown>) {
  return (await t.json("/api/items", { json: item }, 201)).id as number;
}

const categoryOf = async (id: number) => (await t.json(`/api/items/${id}`)).category;

beforeEach(async () => {
  t = await createTestApp();
});

describe("categories", () => {
  it("lists every level with direct and nested counts", async () => {
    await create({ name: "A", url: "https://a.dev", category: "前端/React" });
    await create({ name: "B", url: "https://b.dev", category: "前端/React" });
    await create({ name: "C", url: "https://c.dev", category: "后端" });
    const list: { category: string }[] = await t.json("/api/categories");
    expect(list.sort((x, y) => (x.category < y.category ? -1 : 1))).toEqual([
      { category: "前端", count: 0, total: 2 },
      { category: "前端/React", count: 2, total: 2 },
      { category: "后端", count: 1, total: 1 },
    ]);
  });

  it("renames a category with its sub-categories, merging into an existing one", async () => {
    const a = await create({ name: "A", url: "https://a.dev", category: "前端" });
    const b = await create({ name: "B", url: "https://b.dev", category: "前端/React" });
    const other = await create({ name: "C", url: "https://c.dev", category: "前端工具" });
    const web = await create({ name: "D", url: "https://d.dev", category: "Web" });
    const { slug } = await t.json("/api/shares", { json: { type: "category", value: "前端/React" } });

    expect(await t.json("/api/categories/rename", { json: { from: "前端", to: " Web/ " } })).toEqual({
      ok: true,
      affected: 2,
    });
    expect(await categoryOf(a)).toBe("Web");
    expect(await categoryOf(b)).toBe("Web/React");
    expect(await categoryOf(other)).toBe("前端工具");
    expect(await categoryOf(web)).toBe("Web");
    // Shares follow the rename.
    expect((await t.json(`/api/public/shares/${slug}`, { auth: false })).value).toBe("Web/React");
  });

  it("treats % and _ in names literally", async () => {
    const a = await create({ name: "A", url: "https://a.dev", category: "a_b/x" });
    const b = await create({ name: "B", url: "https://b.dev", category: "aXb/x" });
    await t.json("/api/categories/rename", { json: { from: "a_b", to: "c" } });
    expect(await categoryOf(a)).toBe("c/x");
    expect(await categoryOf(b)).toBe("aXb/x");
  });

  it("refuses to move a category into itself or to an empty name", async () => {
    await create({ name: "A", url: "https://a.dev", category: "前端" });
    await t.json("/api/categories/rename", { json: { from: "前端", to: "前端/旧" } }, 400);
    await t.json("/api/categories/rename", { json: { from: "前端", to: " / " } }, 400);
  });

  it("deletes one level, lifting bookmarks and sub-categories to the parent", async () => {
    const a = await create({ name: "A", url: "https://a.dev", category: "前端/React" });
    const b = await create({ name: "B", url: "https://b.dev", category: "前端/React/Hooks" });
    const c = await create({ name: "C", url: "https://c.dev", category: "前端" });
    await t.json("/api/categories/delete", { json: { category: "前端/React" } });
    expect(await categoryOf(a)).toBe("前端");
    expect(await categoryOf(b)).toBe("前端/Hooks");

    await t.json("/api/categories/delete", { json: { category: "前端" } });
    expect(await categoryOf(c)).toBe("");
    expect(await categoryOf(b)).toBe("Hooks");
    await t.json("/api/categories/delete", { json: { category: "" } }, 400);
  });
});
