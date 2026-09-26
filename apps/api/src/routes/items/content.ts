// Page text snapshot of one bookmark: its status (plus the text with ?text=1,
// so opening the detail panel doesn't download it), or capture it again now.
// /content/recapture-all schedules every bookmark for the backfill instead.

import { Hono } from "hono";
import type { Env } from "#types";
import { captureContent, contentEnabled, readContent, scheduleRecaptureAll } from "#item-content";

export const contentRoutes = new Hono<{ Bindings: Env }>();

type Row = { url: string; content_status: string; content_at: number | null; content_size: number | null };

const getRow = (db: D1Database, id: number) =>
  db
    .prepare("SELECT url, content_status, content_at, content_size FROM items WHERE id = ? AND deleted_at IS NULL")
    .bind(id)
    .first<Row>();

async function view(env: Env, id: number, row: Row, withText: boolean) {
  return {
    enabled: contentEnabled(env),
    status: row.content_status,
    capturedAt: row.content_at,
    size: row.content_size,
    text: withText && row.content_status === "ok" ? await readContent(env, id) : null,
  };
}

contentRoutes.post("/content/recapture-all", async (c) => {
  if (!contentEnabled(c.env)) return c.json({ error: "no storage" }, 400);
  return c.json({ scheduled: await scheduleRecaptureAll(c.env) });
});

contentRoutes.get("/:id/content", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await getRow(c.env.DB, id);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(await view(c.env, id, row, c.req.query("text") === "1"));
});

contentRoutes.post("/:id/content", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await getRow(c.env.DB, id);
  if (!row) return c.json({ error: "not found" }, 404);
  if (!contentEnabled(c.env)) return c.json({ error: "no storage" }, 400);
  await captureContent(c.env, id, row.url);
  return c.json(await view(c.env, id, (await getRow(c.env.DB, id))!, true));
});
