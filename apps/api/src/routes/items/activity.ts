// Checks a GitHub / npm bookmark's activity again now.

import { Hono } from "hono";
import type { Env } from "#types";
import { refreshActivity } from "#activity";

export const activityRoutes = new Hono<{ Bindings: Env }>();

activityRoutes.post("/:id/activity", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await c.env.DB.prepare("SELECT url FROM items WHERE id = ? AND deleted_at IS NULL")
    .bind(id)
    .first<{ url: string }>();
  if (!row) return c.json({ error: "not found" }, 404);
  const activity = await refreshActivity(c.env, id, row.url);
  if (!activity) return c.json({ error: "not a project" }, 400);
  return c.json(activity);
});
