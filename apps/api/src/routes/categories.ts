import { Hono } from "hono";
import type { Env } from "#types";
import { deleteCategory, listCategories, renameCategory } from "#categories";
import { tr } from "#i18n";

export const categoryRoutes = new Hono<{ Bindings: Env }>();

categoryRoutes.get("/", async (c) => c.json(await listCategories(c.env.DB)));

categoryRoutes.post("/rename", async (c) => {
  const { from, to } = await c.req.json<{ from?: unknown; to?: unknown }>();
  const result = await renameCategory(c.env.DB, from, to);
  if (!result.ok) {
    const key = result.error === "into_itself" ? "api_category_into_itself" : "api_category_invalid";
    return c.json({ error: await tr(c, key) }, 400);
  }
  return c.json(result);
});

categoryRoutes.post("/delete", async (c) => {
  const { category } = await c.req.json<{ category?: unknown }>();
  const affected = await deleteCategory(c.env.DB, category);
  if (affected === null) return c.json({ error: await tr(c, "api_category_invalid") }, 400);
  return c.json({ ok: true, affected });
});
