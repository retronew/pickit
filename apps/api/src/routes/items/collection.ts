// Listing, stats, trash, categories and creating items.

import { Hono } from "hono";
import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { toItemJson, createItem, type NewItem } from "./helpers";

export const collectionRoutes = new Hono<{ Bindings: Env }>();

collectionRoutes.get("/", async (c) => {
  const { category } = c.req.query();
  let sql = `SELECT ${ITEM_COLUMNS} FROM items WHERE deleted_at IS NULL`;
  const args: string[] = [];
  if (category) {
    sql += " AND category = ?";
    args.push(category);
  }
  sql += " ORDER BY pinned DESC, category, name";
  const { results } = await c.env.DB.prepare(sql).bind(...args).all<ItemRow>();
  return c.json(results.map(toItemJson));
});

collectionRoutes.get("/stats", async (c) => {
  const totalRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM items WHERE deleted_at IS NULL",
  ).first<{ n: number }>();
  const { results: byCategory } = await c.env.DB.prepare(
    "SELECT category, COUNT(*) AS count FROM items WHERE deleted_at IS NULL GROUP BY category ORDER BY count DESC",
  ).all<{ category: string; count: number }>();
  const { results: byMonth } = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', created_at / 1000, 'unixepoch') AS month, COUNT(*) AS count
     FROM items WHERE deleted_at IS NULL GROUP BY month ORDER BY month`,
  ).all<{ month: string; count: number }>();
  const { results: clickTop } = await c.env.DB.prepare(
    "SELECT id, name, click_count FROM items WHERE deleted_at IS NULL AND click_count > 0 ORDER BY click_count DESC LIMIT 10",
  ).all<{ id: number; name: string; click_count: number }>();
  const embeddedRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM items WHERE deleted_at IS NULL AND embedding IS NOT NULL",
  ).first<{ n: number }>();
  const deadRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM items WHERE deleted_at IS NULL AND checked_at IS NOT NULL
     AND (http_status IS NULL OR http_status >= 400)`,
  ).first<{ n: number }>();
  const trashRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM items WHERE deleted_at IS NOT NULL",
  ).first<{ n: number }>();

  const total = totalRow?.n ?? 0;
  return c.json({
    total,
    byCategory: byCategory.map((r) => ({
      category: r.category || "未分类",
      count: r.count,
    })),
    byMonth,
    clickTop: clickTop.map((r) => ({
      id: r.id,
      name: r.name,
      clickCount: r.click_count,
    })),
    embeddingCoverage: total > 0 ? (embeddedRow?.n ?? 0) / total : 0,
    deadLinks: deadRow?.n ?? 0,
    trash: trashRow?.n ?? 0,
  });
});

collectionRoutes.get("/trash", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM items WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`,
  ).all<ItemRow>();
  return c.json(results.map(toItemJson));
});

collectionRoutes.get("/categories", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT DISTINCT category FROM items WHERE category != '' AND deleted_at IS NULL ORDER BY category",
  ).all<{ category: string }>();
  return c.json(results.map((r) => r.category));
});

collectionRoutes.post("/", async (c) => {
  const body = await c.req.json<NewItem & { allowDuplicate?: boolean }>();
  if (!body.name) return c.json({ error: "name required" }, 400);
  const result = await createItem(c.env, body, {
    allowDuplicate: body.allowDuplicate,
    waitUntil: (p) => c.executionCtx.waitUntil(p),
  });
  if ("duplicate" in result) return c.json({ error: "duplicate", existing: result.duplicate }, 409);
  return c.json({ id: result.id }, 201);
});
