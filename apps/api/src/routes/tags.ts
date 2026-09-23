import { Hono } from "hono";
import type { Env } from "#types";

export const tagRoutes = new Hono<{ Bindings: Env }>();

tagRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT value AS tag, COUNT(*) AS count FROM items, json_each(items.tags)
     WHERE deleted_at IS NULL AND value != ''
     GROUP BY value ORDER BY count DESC, tag`,
  ).all<{ tag: string; count: number }>();
  return c.json(results);
});

async function itemsWithTag(db: D1Database, tag: string) {
  const { results } = await db
    .prepare(
      `SELECT id, tags FROM items
       WHERE deleted_at IS NULL AND EXISTS (SELECT 1 FROM json_each(items.tags) WHERE value = ?)`,
    )
    .bind(tag)
    .all<{ id: number; tags: string }>();
  return results;
}

async function batchUpdateTags(
  db: D1Database,
  rows: { id: number; tags: string[] }[],
) {
  const now = Date.now();
  const stmts = rows.map((r) =>
    db
      .prepare("UPDATE items SET tags=?, updated_at=? WHERE id=?")
      .bind(JSON.stringify(r.tags), now, r.id),
  );
  for (let i = 0; i < stmts.length; i += 50) {
    await db.batch(stmts.slice(i, i + 50));
  }
}

tagRoutes.post("/rename", async (c) => {
  const { from, to } = await c.req.json<{ from?: string; to?: string }>();
  if (!from || !to) return c.json({ error: "from and to required" }, 400);
  const rows = await itemsWithTag(c.env.DB, from);
  await batchUpdateTags(
    c.env.DB,
    rows.map((r) => {
      const tags: string[] = JSON.parse(r.tags || "[]");
      const next = Array.from(new Set(tags.map((t) => (t === from ? to : t))));
      return { id: r.id, tags: next };
    }),
  );
  return c.json({ ok: true, affected: rows.length });
});

tagRoutes.post("/delete", async (c) => {
  const { tag } = await c.req.json<{ tag?: string }>();
  if (!tag) return c.json({ error: "tag required" }, 400);
  const rows = await itemsWithTag(c.env.DB, tag);
  await batchUpdateTags(
    c.env.DB,
    rows.map((r) => ({
      id: r.id,
      tags: (JSON.parse(r.tags || "[]") as string[]).filter((t) => t !== tag),
    })),
  );
  return c.json({ ok: true, affected: rows.length });
});
