import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../../test/app";

let t: TestApp;

async function create(item: Record<string, unknown>) {
  return (await t.json<{ id: number }>("/api/items", { json: item }, 201)).id;
}

beforeEach(async () => {
  t = await createTestApp();
});

describe("item CRUD", () => {
  it("creates, reads, lists, updates and pins an item", async () => {
    const id = await create({
      name: "Hono",
      url: "https://hono.dev",
      note: "Web framework",
      category: "后端",
      tags: ["ts", "edge"],
    });

    const item = await t.json(`/api/items/${id}`);
    expect(item).toMatchObject({
      id,
      name: "Hono",
      url: "https://hono.dev",
      category: "后端",
      tags: ["ts", "edge"],
      pinned: false,
      deletedAt: null,
    });

    await t.json(`/api/items/${id}`, { method: "PUT", json: { name: "Hono.js", tags: ["ts"] } });
    await t.json(`/api/items/${id}`, { method: "PUT", json: { pinned: true } });
    const list = await t.json("/api/items");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Hono.js", tags: ["ts"], pinned: true });
  });

  it("requires a name", async () => {
    await t.json("/api/items", { json: { url: "https://x.dev" } }, 400);
  });

  it("returns 404 for unknown items", async () => {
    await t.json("/api/items/999", {}, 404);
    await t.json("/api/items/999", { method: "PUT", json: { name: "x" } }, 404);
  });

  it("rejects duplicate URLs (ignoring scheme, case and trailing slash) unless allowed", async () => {
    await create({ name: "A", url: "https://Example.com/page/" });
    const dup = await t.json("/api/items", { json: { name: "B", url: "http://example.com/page" } }, 409);
    expect(dup).toMatchObject({ error: "duplicate", existing: { name: "A" } });
    await create({ name: "B", url: "http://example.com/page", allowDuplicate: true });
    expect(await t.json("/api/items")).toHaveLength(2);
  });

  it("rejects changing a URL to one that already exists", async () => {
    await create({ name: "A", url: "https://a.dev" });
    const b = await create({ name: "B", url: "https://b.dev" });
    await t.json(`/api/items/${b}`, { method: "PUT", json: { url: "https://a.dev" } }, 409);
  });

  it("counts visits", async () => {
    const id = await create({ name: "A", url: "https://a.dev" });
    await t.request(`/api/items/${id}/visit`, { method: "POST" });
    await t.request(`/api/items/${id}/visit`, { method: "POST" });
    expect((await t.json(`/api/items/${id}`)).clickCount).toBe(2);
  });
});

describe("trash", () => {
  it("soft-deletes into the trash, restores and purges", async () => {
    const id = await create({ name: "A", url: "https://a.dev" });

    await t.json(`/api/items/${id}`, { method: "DELETE" });
    expect(await t.json("/api/items")).toEqual([]);
    const trash = await t.json("/api/items/trash");
    expect(trash.map((i: { id: number }) => i.id)).toEqual([id]);
    expect(trash[0].deletedAt).toEqual(expect.any(Number));

    await t.json(`/api/items/${id}/restore`, { method: "POST" });
    expect(await t.json("/api/items")).toHaveLength(1);
    expect(await t.json("/api/items/trash")).toEqual([]);

    await t.json(`/api/items/${id}`, { method: "DELETE" });
    await t.json(`/api/items/${id}/purge`, { method: "DELETE" });
    expect(await t.json("/api/items/trash")).toEqual([]);
    await t.json(`/api/items/${id}`, {}, 404);
  });

  it("does not treat trashed items as duplicates", async () => {
    const id = await create({ name: "A", url: "https://a.dev" });
    await t.json(`/api/items/${id}`, { method: "DELETE" });
    await create({ name: "A again", url: "https://a.dev" });
  });
});

describe("bulk actions", () => {
  let ids: number[];
  beforeEach(async () => {
    ids = [
      await create({ name: "A", url: "https://a.dev" }),
      await create({ name: "B", url: "https://b.dev" }),
      await create({ name: "C", url: "https://c.dev" }),
    ];
  });

  it("pins, recategorizes and deletes a selection", async () => {
    const pick = ids.slice(0, 2);
    expect(await t.json("/api/items/bulk", { json: { ids: pick, action: "pin" } })).toEqual({
      ok: true,
      count: 2,
    });
    await t.json("/api/items/bulk", { json: { ids: pick, action: "category", value: "工具" } });
    let list = await t.json("/api/items");
    for (const item of list.filter((i: { id: number }) => pick.includes(i.id))) {
      expect(item).toMatchObject({ pinned: true, category: "工具" });
    }

    await t.json("/api/items/bulk", { json: { ids: pick, action: "delete" } });
    list = await t.json("/api/items");
    expect(list.map((i: { id: number }) => i.id)).toEqual([ids[2]]);
    expect(await t.json("/api/items/trash")).toHaveLength(2);

    await t.json("/api/items/bulk", { json: { ids: pick, action: "purge" } });
    expect(await t.json("/api/items/trash")).toEqual([]);
  });

  it("validates input", async () => {
    await t.json("/api/items/bulk", { json: { ids: [], action: "pin" } }, 400);
    await t.json("/api/items/bulk", { json: { ids, action: "category" } }, 400);
    await t.json("/api/items/bulk", { json: { ids, action: "explode" } }, 400);
  });
});

describe("merge", () => {
  it("keeps one item, unions tags and trashes the rest", async () => {
    const keep = await create({ name: "Keep", url: "https://k.dev", tags: ["a"] });
    const drop = await create({ name: "Drop", url: "https://d.dev", tags: ["a", "b"] });
    await t.json("/api/items/merge", { json: { keepId: keep, removeIds: [drop] } });

    const list = await t.json("/api/items");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: keep });
    expect([...list[0].tags].sort()).toEqual(["a", "b"]);
    expect((await t.json("/api/items/trash"))[0].id).toBe(drop);
  });

  it("validates input", async () => {
    await t.json("/api/items/merge", { json: { keepId: 1, removeIds: [] } }, 400);
    await t.json("/api/items/merge", { json: { keepId: 404, removeIds: [1] } }, 404);
  });
});

describe("manual order", () => {
  it("stores a group's new order; untouched items keep a null position", async () => {
    const a = await create({ name: "A", url: "https://a.dev" });
    const b = await create({ name: "B", url: "https://b.dev" });
    const c = await create({ name: "C", url: "https://c.dev" });
    expect(await t.json("/api/items/reorder", { json: { ids: [c, a] } })).toEqual({ ok: true, count: 2 });
    const byId = new Map((await t.json("/api/items")).map((i: { id: number; position: number | null }) => [i.id, i.position]));
    expect([byId.get(c), byId.get(a), byId.get(b)]).toEqual([0, 1, null]);
    await t.json("/api/items/reorder", { json: { ids: [] } }, 400);
  });
});

describe("categories, stats and duplicates", () => {
  it("summarizes active items only", async () => {
    await create({ name: "A", url: "https://a.dev", category: "前端/React" });
    await create({ name: "B", url: "https://b.dev", category: "前端/React" });
    const gone = await create({ name: "C", url: "https://c.dev", category: "后端" });
    await t.json(`/api/items/${gone}`, { method: "DELETE" });

    expect(await t.json("/api/items/categories")).toEqual(["前端/React"]);
    const stats = await t.json("/api/items/stats");
    expect(stats).toMatchObject({ total: 2, byCategory: [{ category: "前端/React", count: 2 }] });
  });

  it("groups items that share a URL", async () => {
    await create({ name: "A", url: "https://same.dev" });
    await create({ name: "A2", url: "https://same.dev/", allowDuplicate: true });
    await create({ name: "Other", url: "https://other.dev" });
    const groups = await t.json("/api/items/duplicates");
    expect(groups).toHaveLength(1);
    expect(groups[0].map((i: { name: string }) => i.name).sort()).toEqual(["A", "A2"]);
  });
});

describe("import / export", () => {
  const markdown = [
    "| 名称 | 链接 | 备注 | 分类 |",
    "| --- | --- | --- | --- |",
    "| Vite | https://vite.dev | 构建工具 | 前端 |",
    "| Hono | https://hono.dev | Web 框架 | 后端 |",
  ].join("\n");

  it("previews without writing, then imports and skips duplicates", async () => {
    const preview = await t.json("/api/items/import", {
      json: { format: "markdown", content: markdown, dryRun: true },
    });
    // A dry run reports what would be inserted, without writing.
    expect(preview).toMatchObject({ parsed: 2, inserted: 2, skipped: 0 });
    expect(preview.preview).toHaveLength(2);
    expect(await t.json("/api/items")).toEqual([]);

    const first = await t.json("/api/items/import", { json: { format: "markdown", content: markdown } });
    expect(first).toMatchObject({ parsed: 2, inserted: 2, skipped: 0 });
    const again = await t.json("/api/items/import", { json: { format: "markdown", content: markdown } });
    expect(again).toMatchObject({ inserted: 0, skipped: 2 });
  });

  it("rejects empty or unparseable content", async () => {
    await t.json("/api/items/import", { json: { format: "markdown" } }, 400);
    await t.json("/api/items/import", { json: { format: "json", content: "not json" } }, 400);
  });

  it("round-trips through the JSON export", async () => {
    await create({ name: "Vite", url: "https://vite.dev", category: "前端", tags: ["build"] });
    const res = await t.request("/api/items/export?format=json");
    expect(res.headers.get("content-disposition")).toMatch(/pickit-.*\.json/);
    const exported = await res.text();

    const other = await createTestApp();
    const result = await other.json("/api/items/import", { json: { format: "json", content: exported } });
    expect(result).toMatchObject({ inserted: 1 });
    expect((await other.json("/api/items"))[0]).toMatchObject({
      name: "Vite",
      category: "前端",
      tags: ["build"],
    });
  });

  it("exports markdown and bookmark HTML with escaping", async () => {
    await create({ name: "A <b>&", url: "https://a.dev" });
    expect(await (await t.request("/api/items/export?format=markdown")).text()).toContain("https://a.dev");
    const html = await (await t.request("/api/items/export?format=html")).text();
    expect(html).toContain("A &lt;b&gt;&amp;");
    expect(html).not.toContain("<b>");
  });
});

describe("search without AI", () => {
  it("finds items by keyword and skips trashed ones", async () => {
    await create({ name: "Recharts", url: "https://recharts.org", note: "React charts" });
    const gone = await create({ name: "Chart.js", url: "https://chartjs.org", note: "charts" });
    await create({ name: "Hono", url: "https://hono.dev" });
    await t.json(`/api/items/${gone}`, { method: "DELETE" });

    const { hits } = await t.json("/api/search?q=Recharts");
    expect(hits.map((h: { name: string }) => h.name)).toEqual(["Recharts"]);
    expect((await t.json("/api/search?q=")).hits).toEqual([]);
  });
});
