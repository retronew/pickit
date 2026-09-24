// Manual order: the client sends the ids of one group in their new order.

import { Hono } from "hono";
import type { Env } from "#types";
import { normalizeIds } from "#shares";
import { tr } from "#i18n";

export const orderRoutes = new Hono<{ Bindings: Env }>();

orderRoutes.post("/reorder", async (c) => {
  const { ids: raw } = await c.req.json<{ ids?: unknown }>();
  const ids = normalizeIds(raw);
  if (!ids) return c.json({ error: await tr(c, "api_share_invalid") }, 400);
  const stmts = ids.map((id, position) =>
    c.env.DB.prepare("UPDATE items SET position = ? WHERE id = ?").bind(position, id),
  );
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));
  return c.json({ ok: true, count: ids.length });
});
