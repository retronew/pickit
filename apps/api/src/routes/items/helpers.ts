// Shared helpers for the item routes.

import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { nearest, vectorColumns } from "#vectors";
import { createProvider, embedText, embeddingInput, type Provider, type AiSettings } from "#ai";
import { normalizeUrl } from "@pickit/shared";
import { getSettings } from "#settings";

export async function itemsByIds(db: D1Database, ids: number[]): Promise<Map<number, ItemRow>> {
  if (!ids.length) return new Map();
  const { results } = await db
    .prepare(
      `SELECT ${ITEM_COLUMNS} FROM items WHERE deleted_at IS NULL AND id IN (${ids.map(() => "?").join(",")})`,
    )
    .bind(...ids)
    .all<ItemRow>();
  return new Map(results.map((r) => [r.id, r]));
}

export function toItemJson(r: ItemRow) {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    icon: r.icon,
    note: r.note,
    category: r.category,
    tags: JSON.parse(r.tags || "[]"),
    pinned: !!r.pinned,
    hasEmbedding: !!r.has_embedding,
    clickCount: r.click_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    aiSummary: r.ai_summary,
    httpStatus: r.http_status,
    checkedAt: r.checked_at,
    image: r.image,
    archiveUrl: r.archive_url,
  };
}

export async function findDuplicate(db: D1Database, urlNorm: string, excludeId?: number) {
  if (!urlNorm) return null;
  let sql = "SELECT id, name FROM items WHERE url_norm = ? AND deleted_at IS NULL";
  const args: (string | number)[] = [urlNorm];
  if (excludeId != null) {
    sql += " AND id != ?";
    args.push(excludeId);
  }
  return db
    .prepare(sql)
    .bind(...args)
    .first<{ id: number; name: string }>();
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function findSimilarItems(
  db: D1Database,
  provider: Provider,
  item: { name: string; note?: string; category?: string },
) {
  const vec = await embedText(provider, embeddingInput(item));
  if (!vec) return [];
  const top = await nearest(db, vec, provider.embeddingModelId!, { limit: 3, minScore: 0.85 });
  const rows = await itemsByIds(db, top.map((t) => t.id));
  return top.flatMap((t) => {
    const r = rows.get(t.id);
    return r ? [{ id: r.id, name: r.name, url: r.url, category: r.category, score: t.score }] : [];
  });
}

export async function embedItem(
  env: Env,
  id: number,
  item: { name: string; url?: string; note?: string; category?: string },
  settings: AiSettings,
) {
  const provider = createProvider(settings);
  if (!provider?.embedding) return;
  const vec = await embedText(provider, embeddingInput(item));
  if (!vec) return;
  const cols = vectorColumns(vec);
  await env.DB.prepare(
    "UPDATE items SET embedding=?, vec=?, embedding_model=? WHERE id=?",
  )
    .bind(cols.embedding, cols.vec, provider.embeddingModelId, id)
    .run();
}

export interface NewItem {
  name: string;
  url?: string;
  icon?: string;
  image?: string;
  note?: string;
  category?: string;
  tags?: string[];
}

/**
 * Inserts an item unless its URL is already saved (then returns that one),
 * and embeds it in the background when an embedding model is configured.
 */
export async function createItem(
  env: Env,
  item: NewItem,
  opts: { allowDuplicate?: boolean; waitUntil: (p: Promise<unknown>) => void },
): Promise<{ id: number } | { duplicate: Awaited<ReturnType<typeof findDuplicate>> }> {
  const urlNorm = normalizeUrl(item.url ?? "");
  if (!opts.allowDuplicate) {
    const dup = await findDuplicate(env.DB, urlNorm);
    if (dup) return { duplicate: dup };
  }
  const now = Date.now();
  const { meta } = await env.DB.prepare(
    "INSERT INTO items (name, url, icon, image, preview_checked_at, note, category, tags, url_norm, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      item.name,
      item.url ?? "",
      item.icon ?? "",
      item.image ?? "",
      // An image from "AI analyze" means the page was already read.
      item.image ? now : null,
      item.note ?? "",
      item.category ?? "",
      JSON.stringify(item.tags ?? []),
      urlNorm,
      now,
      now,
    )
    .run();
  const id = Number(meta.last_row_id);
  const settings = await getSettings(env.DB);
  if (settings) opts.waitUntil(embedItem(env, id, item, settings).catch(() => {}));
  return { id };
}
