// Single-item routes: update, visit, delete / restore / purge, get.

import { Hono } from "hono";
import { normalizeUrl } from "@pickit/shared";
import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { getSettings } from "#settings";
import { toItemJson, findDuplicate, embedItem } from "./helpers";

export const itemByIdRoutes = new Hono<{ Bindings: Env }>();

itemByIdRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{
    name?: string;
    url?: string;
    icon?: string;
    image?: string;
    note?: string;
    category?: string;
    tags?: string[];
    pinned?: boolean;
    allowDuplicate?: boolean;
  }>();
  const existing = await c.env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = ?`)
    .bind(id)
    .first<ItemRow>();
  if (!existing) return c.json({ error: "not found" }, 404);
  const merged = {
    name: body.name ?? existing.name,
    url: body.url ?? existing.url,
    icon: body.icon ?? existing.icon,
    image: body.image ?? existing.image,
    note: body.note ?? existing.note,
    category: body.category ?? existing.category,
    tags: body.tags ?? JSON.parse(existing.tags || "[]"),
    pinned: body.pinned ?? !!existing.pinned,
  };
  const urlNorm = normalizeUrl(merged.url);
  if (urlNorm !== existing.url_norm && !body.allowDuplicate) {
    const dup = await findDuplicate(c.env.DB, urlNorm, id);
    if (dup) return c.json({ error: "duplicate", existing: dup }, 409);
  }
  await c.env.DB.prepare(
    "UPDATE items SET name=?, url=?, icon=?, image=?, note=?, category=?, tags=?, pinned=?, url_norm=?, updated_at=? WHERE id=?",
  )
    .bind(
      merged.name,
      merged.url,
      merged.icon,
      merged.image,
      merged.note,
      merged.category,
      JSON.stringify(merged.tags),
      merged.pinned ? 1 : 0,
      urlNorm,
      Date.now(),
      id,
    )
    .run();
  const settings = await getSettings(c.env.DB);
  if (settings) {
    c.executionCtx.waitUntil(
      embedItem(c.env, id, merged, settings).catch(() => {}),
    );
  }
  return c.json({ ok: true });
});

itemByIdRoutes.post("/:id/visit", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare(
    "UPDATE items SET click_count = click_count + 1, last_visited_at = ? WHERE id = ?",
  )
    .bind(Date.now(), id)
    .run();
  return c.json({ ok: true });
});

itemByIdRoutes.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("UPDATE items SET deleted_at = ? WHERE id = ?")
    .bind(Date.now(), id)
    .run();
  return c.json({ ok: true });
});

itemByIdRoutes.post("/:id/restore", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("UPDATE items SET deleted_at = NULL WHERE id = ?")
    .bind(id)
    .run();
  return c.json({ ok: true });
});

itemByIdRoutes.delete("/:id/purge", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

itemByIdRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await c.env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM items WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(id)
    .first<ItemRow>();
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(toItemJson(row));
});
