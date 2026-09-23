// Bulk edits on a selection, and AI organize suggestions to review first.

import { Hono } from "hono";
import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { getSettings } from "#settings";
import { createProvider, describeError } from "#ai";
import { activeCategories, suggestOrganize } from "#organize";
import { LocalizedError, renderMessage, requestLocale, tr } from "#i18n";
import { aiLocale } from "#locale";

export const bulkRoutes = new Hono<{ Bindings: Env }>();

const MAX_IDS = 500;
const MAX_SUGGEST = 20;
const MAX_UPDATES = 100;

type BulkAction =
  | "delete"
  | "restore"
  | "purge"
  | "pin"
  | "unpin"
  | "category"
  | "add_tags"
  | "remove_tags"
  | "apply";

interface BulkBody {
  ids?: unknown;
  action?: BulkAction;
  value?: unknown;
  tags?: unknown;
  updates?: unknown;
}

function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return [
    ...new Set(
      tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
}

function cleanIds(ids: unknown, max: number): number[] {
  return Array.isArray(ids) ? ids.filter((n): n is number => Number.isInteger(n)).slice(0, max) : [];
}

/** Rewrites the tags of the given active items with `edit`; returns how many changed. */
async function editTags(db: D1Database, ids: number[], edit: (tags: string[]) => string[]) {
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await db
    .prepare(`SELECT id, tags FROM items WHERE deleted_at IS NULL AND id IN (${placeholders})`)
    .bind(...ids)
    .all<{ id: number; tags: string }>();
  const now = Date.now();
  const updates = results.flatMap((r) => {
    const before: string[] = JSON.parse(r.tags || "[]");
    const after = edit(before);
    if (after.length === before.length && after.every((t, i) => t === before[i])) return [];
    return [
      db
        .prepare("UPDATE items SET tags = ?, updated_at = ? WHERE id = ?")
        .bind(JSON.stringify(after), now, r.id),
    ];
  });
  if (updates.length) await db.batch(updates);
  return updates.length;
}

/** "apply": one category / tags pair per item, e.g. reviewed AI suggestions. */
async function applyUpdates(db: D1Database, raw: unknown) {
  const updates = (Array.isArray(raw) ? raw : [])
    .filter(
      (u): u is { id: number; category?: unknown; tags?: unknown } =>
        !!u && typeof u === "object" && Number.isInteger((u as { id?: unknown }).id),
    )
    .slice(0, MAX_UPDATES);
  if (updates.length === 0) return 0;
  const now = Date.now();
  await db.batch(
    updates.map((u) =>
      db
        .prepare(
          `UPDATE items SET category = COALESCE(?, category), tags = COALESCE(?, tags), updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
        )
        .bind(
          typeof u.category === "string" ? u.category.trim() : null,
          Array.isArray(u.tags) ? JSON.stringify(cleanTags(u.tags)) : null,
          now,
          u.id,
        ),
    ),
  );
  return updates.length;
}

bulkRoutes.post("/bulk", async (c) => {
  const body = await c.req.json<BulkBody>();
  const db = c.env.DB;

  if (body.action === "apply") {
    const count = await applyUpdates(db, body.updates);
    if (count === 0) return c.json({ error: "updates required" }, 400);
    return c.json({ ok: true, count });
  }

  const ids = cleanIds(body.ids, MAX_IDS);
  if (ids.length === 0) return c.json({ error: "ids required" }, 400);
  const placeholders = ids.map(() => "?").join(",");
  const now = Date.now();
  const run = (sql: string, ...args: unknown[]) =>
    db
      .prepare(sql.replace("$IDS", placeholders))
      .bind(...args, ...ids)
      .run();

  switch (body.action) {
    case "delete":
      await run("UPDATE items SET deleted_at = ? WHERE id IN ($IDS)", now);
      break;
    case "restore":
      await run("UPDATE items SET deleted_at = NULL WHERE id IN ($IDS)");
      break;
    case "purge":
      await run("DELETE FROM items WHERE id IN ($IDS)");
      break;
    case "pin":
    case "unpin":
      await run(
        "UPDATE items SET pinned = ?, updated_at = ? WHERE id IN ($IDS)",
        body.action === "pin" ? 1 : 0,
        now,
      );
      break;
    case "category":
      if (typeof body.value !== "string") return c.json({ error: "value required" }, 400);
      await run("UPDATE items SET category = ?, updated_at = ? WHERE id IN ($IDS)", body.value, now);
      break;
    case "add_tags":
    case "remove_tags": {
      const tags = cleanTags(body.tags);
      if (tags.length === 0) return c.json({ error: "tags required" }, 400);
      const changed = await editTags(db, ids, (current) =>
        body.action === "add_tags"
          ? [...new Set([...current, ...tags])]
          : current.filter((t) => !tags.includes(t)),
      );
      return c.json({ ok: true, count: ids.length, changed });
    }
    default:
      return c.json({ error: "unknown action" }, 400);
  }
  return c.json({ ok: true, count: ids.length });
});

export interface SuggestionRow {
  id: number;
  name: string;
  url: string;
  category: string;
  tags: string[];
  suggested?: { category: string; tags: string[] };
  error?: string;
}

/** AI category / tags for up to 20 items, without changing anything. */
bulkRoutes.post("/suggest", async (c) => {
  const body = await c.req.json<{ ids?: unknown }>().catch(() => ({}) as { ids?: unknown });
  const ids = cleanIds(body.ids, MAX_SUGGEST);
  if (ids.length === 0) return c.json({ error: "ids required" }, 400);
  const settings = await getSettings(c.env.DB);
  const chat = settings ? createProvider(settings)?.chat : undefined;
  if (!chat) return c.json({ error: await tr(c, "api_need_chat") }, 400);

  const { results: rows } = await c.env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM items WHERE deleted_at IS NULL AND id IN (${ids.map(() => "?").join(",")})`,
  )
    .bind(...ids)
    .all<ItemRow>();
  const [categories, locale] = await Promise.all([activeCategories(c.env.DB), aiLocale(c.env.DB)]);
  const outcomes = await Promise.allSettled(rows.map((row) => suggestOrganize(chat, row, categories, locale)));
  const errorLocale = await requestLocale(c);
  const suggestions: SuggestionRow[] = rows.map((row, i) => {
    const o = outcomes[i];
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      category: row.category,
      tags: JSON.parse(row.tags || "[]"),
      ...(o.status === "fulfilled"
        ? { suggested: o.value }
        : {
            error:
              o.reason instanceof LocalizedError
                ? renderMessage(o.reason.ref, errorLocale)
                : describeError(o.reason),
          }),
    };
  });
  return c.json({ suggestions });
});
