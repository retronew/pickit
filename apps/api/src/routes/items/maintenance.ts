// Duplicates, merging, bulk actions and link checks.

import { Hono } from "hono";
import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { similarGroups } from "#vectors";
import { createProvider } from "#ai";
import { getSettings } from "#settings";
import { checkLink } from "#cron";
import { toItemJson } from "./helpers";

export const maintenanceRoutes = new Hono<{ Bindings: Env }>();

maintenanceRoutes.get("/duplicates", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM items WHERE deleted_at IS NULL`,
  ).all<ItemRow>();

  const groups: ItemRow[][] = [];
  const used = new Set<number>();

  const byUrl = new Map<string, ItemRow[]>();
  for (const r of results) {
    if (!r.url_norm) continue;
    if (!byUrl.has(r.url_norm)) byUrl.set(r.url_norm, []);
    byUrl.get(r.url_norm)!.push(r);
  }
  for (const list of byUrl.values()) {
    if (list.length > 1) {
      groups.push(list);
      list.forEach((r) => used.add(r.id));
    }
  }

  const settings = await getSettings(c.env.DB);
  const model = settings ? createProvider(settings)?.embeddingModelId : undefined;
  if (model) {
    const byId = new Map(results.map((r) => [r.id, r]));
    for (const ids of await similarGroups(c.env.DB, model, used)) {
      groups.push(ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])));
    }
  }

  return c.json(groups.map((g) => g.map(toItemJson)));
});

maintenanceRoutes.post("/merge", async (c) => {
  const { keepId, removeIds } = await c.req.json<{
    keepId?: number;
    removeIds?: number[];
  }>();
  if (!keepId || !Array.isArray(removeIds) || removeIds.length === 0) {
    return c.json({ error: "keepId and removeIds required" }, 400);
  }
  const keep = await c.env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = ?`)
    .bind(keepId)
    .first<ItemRow>();
  if (!keep) return c.json({ error: "not found" }, 404);
  const ids = removeIds.filter((id) => id !== keepId);
  if (ids.length === 0) return c.json({ ok: true });
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await c.env.DB.prepare(
    `SELECT tags FROM items WHERE id IN (${placeholders})`,
  )
    .bind(...ids)
    .all<{ tags: string }>();
  const mergedTags = new Set<string>(JSON.parse(keep.tags || "[]"));
  for (const r of results) {
    for (const t of JSON.parse(r.tags || "[]")) mergedTags.add(t);
  }
  const now = Date.now();
  await c.env.DB.prepare("UPDATE items SET tags=?, updated_at=? WHERE id=?")
    .bind(JSON.stringify([...mergedTags]), now, keepId)
    .run();
  await c.env.DB.prepare(
    `UPDATE items SET deleted_at=? WHERE id IN (${placeholders})`,
  )
    .bind(now, ...ids)
    .run();
  return c.json({ ok: true });
});

maintenanceRoutes.post("/bulk", async (c) => {
  const body = await c.req.json<{
    ids?: number[];
    action?: "delete" | "restore" | "purge" | "pin" | "unpin" | "category";
    value?: unknown;
  }>();
  const ids = (body.ids ?? [])
    .filter((n) => Number.isInteger(n))
    .slice(0, 500);
  if (ids.length === 0) return c.json({ error: "ids required" }, 400);
  const placeholders = ids.map(() => "?").join(",");
  const now = Date.now();

  switch (body.action) {
    case "delete":
      await c.env.DB.prepare(
        `UPDATE items SET deleted_at = ? WHERE id IN (${placeholders})`,
      )
        .bind(now, ...ids)
        .run();
      break;
    case "restore":
      await c.env.DB.prepare(
        `UPDATE items SET deleted_at = NULL WHERE id IN (${placeholders})`,
      )
        .bind(...ids)
        .run();
      break;
    case "purge":
      await c.env.DB.prepare(
        `DELETE FROM items WHERE id IN (${placeholders})`,
      )
        .bind(...ids)
        .run();
      break;
    case "pin":
    case "unpin":
      await c.env.DB.prepare(
        `UPDATE items SET pinned = ?, updated_at = ? WHERE id IN (${placeholders})`,
      )
        .bind(body.action === "pin" ? 1 : 0, now, ...ids)
        .run();
      break;
    case "category":
      if (typeof body.value !== "string") {
        return c.json({ error: "value required" }, 400);
      }
      await c.env.DB.prepare(
        `UPDATE items SET category = ?, updated_at = ? WHERE id IN (${placeholders})`,
      )
        .bind(body.value, now, ...ids)
        .run();
      break;
    default:
      return c.json({ error: "unknown action" }, 400);
  }
  return c.json({ ok: true, count: ids.length });
});

maintenanceRoutes.post("/:id/check", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await c.env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = ?`)
    .bind(id)
    .first<ItemRow>();
  if (!row) return c.json({ error: "not found" }, 404);
  const status = await checkLink(row.url);
  const checkedAt = Date.now();
  await c.env.DB.prepare(
    "UPDATE items SET http_status=?, checked_at=? WHERE id=?",
  )
    .bind(status, checkedAt, id)
    .run();
  return c.json({ httpStatus: status, checkedAt });
});
