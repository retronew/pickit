import { Hono } from "hono";
import type { Env } from "#types";
import { cleanUrl, deliver, newSecret, parseEvents, webhookView, type WebhookRow } from "#webhooks";
import { tr } from "#i18n";

export const webhookRoutes = new Hono<{ Bindings: Env }>();

const getHook = (db: D1Database, id: string) =>
  db.prepare("SELECT * FROM webhooks WHERE id = ?").bind(Number(id)).first<WebhookRow>();

webhookRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM webhooks ORDER BY created_at DESC").all<WebhookRow>();
  return c.json(results.map(webhookView));
});

/** Creates a webhook; the secret is returned only here. */
webhookRoutes.post("/", async (c) => {
  const body = await c.req.json<{ url?: unknown; events?: unknown }>();
  const url = cleanUrl(body.url);
  const events = parseEvents(body.events);
  if (!url || events.length === 0) return c.json({ error: await tr(c, "api_webhook_invalid") }, 400);
  const secret = newSecret();
  const { meta } = await c.env.DB.prepare(
    "INSERT INTO webhooks (url, events, secret, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(url, JSON.stringify(events), secret, Date.now())
    .run();
  const row = await getHook(c.env.DB, String(meta.last_row_id));
  return c.json({ ...webhookView(row!), secret }, 201);
});

webhookRoutes.patch("/:id", async (c) => {
  const hook = await getHook(c.env.DB, c.req.param("id"));
  if (!hook) return c.json({ error: "not found" }, 404);
  const body = await c.req.json<{ url?: unknown; events?: unknown; enabled?: unknown }>();
  const url = body.url === undefined ? hook.url : cleanUrl(body.url);
  const events = body.events === undefined ? parseEvents(hook.events) : parseEvents(body.events);
  if (!url || events.length === 0) return c.json({ error: await tr(c, "api_webhook_invalid") }, 400);
  const enabled = body.enabled === undefined ? hook.enabled : body.enabled ? 1 : 0;
  await c.env.DB.prepare("UPDATE webhooks SET url = ?, events = ?, enabled = ? WHERE id = ?")
    .bind(url, JSON.stringify(events), enabled, hook.id)
    .run();
  return c.json(webhookView({ ...hook, url, events: JSON.stringify(events), enabled }));
});

webhookRoutes.delete("/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM webhooks WHERE id = ?").bind(Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

/** Sends a "ping" event right away and reports how the endpoint answered. */
webhookRoutes.post("/:id/test", async (c) => {
  const hook = await getHook(c.env.DB, c.req.param("id"));
  if (!hook) return c.json({ error: "not found" }, 404);
  const result = await deliver(c.env.DB, hook, "ping", { webhookId: hook.id });
  return c.json({ ok: result.error === null, ...result });
});
