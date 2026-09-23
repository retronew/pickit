import { Hono } from "hono";
import type { Env } from "#types";

export const shareRoutes = new Hono<{ Bindings: Env }>();

interface ShareRow {
  slug: string;
  title: string;
  type: string;
  value: string;
  created_at: number;
}

shareRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM shares ORDER BY created_at DESC",
  ).all<ShareRow>();
  return c.json(
    results.map((r) => ({
      slug: r.slug,
      title: r.title,
      type: r.type,
      value: r.value,
      createdAt: r.created_at,
    })),
  );
});

shareRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    type?: string;
    value?: string;
    title?: string;
  }>();
  if (!body.type || !body.value) {
    return c.json({ error: "type and value required" }, 400);
  }
  const existing = await c.env.DB.prepare(
    "SELECT slug FROM shares WHERE type = ? AND value = ?",
  )
    .bind(body.type, body.value)
    .first<{ slug: string }>();
  if (existing) return c.json({ slug: existing.slug });

  const slug = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  await c.env.DB.prepare(
    "INSERT INTO shares (slug, title, type, value, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(slug, body.title ?? "", body.type, body.value, Date.now())
    .run();
  return c.json({ slug });
});

shareRoutes.delete("/:slug", async (c) => {
  await c.env.DB.prepare("DELETE FROM shares WHERE slug = ?")
    .bind(c.req.param("slug"))
    .run();
  return c.json({ ok: true });
});
