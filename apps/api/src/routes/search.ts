import { Hono } from "hono";
import { type Env, type ItemRow, ITEM_COLUMNS, itemColumns } from "#types";
import { nearest } from "#vectors";
import { itemsByIds } from "#routes/items/index";
import { getSettings } from "#settings";
import { createProvider } from "#ai";

export const searchRoutes = new Hono<{ Bindings: Env }>();

interface Hit {
  id: number;
  name: string;
  url: string;
  icon: string;
  note: string;
  category: string;
  tags: string[];
  pinned: boolean;
  clickCount: number;
  createdAt: number;
  updatedAt: number;
  score: number;
}

export function ftsQuery(q: string): string {
  return q
    .trim()
    .split(/\s+/)
    .map((t) => `"${t.replace(/"/g, "")}"`)
    .join(" OR ");
}

searchRoutes.get("/", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  if (!q) return c.json({ hits: [] });
  const hits = new Map<number, Hit>();

  // 1. FTS5 keyword search
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT ${itemColumns("i")} FROM items_fts f JOIN items i ON i.id = f.rowid
       WHERE items_fts MATCH ? AND i.deleted_at IS NULL ORDER BY rank LIMIT 30`,
    )
      .bind(ftsQuery(q))
      .all<ItemRow>();
    for (const r of results) {
      hits.set(r.id, { ...toHit(r), score: 1 });
    }
  } catch {
    // fallback LIKE
    const { results } = await c.env.DB.prepare(
      `SELECT ${ITEM_COLUMNS} FROM items WHERE (name LIKE ? OR note LIKE ? OR category LIKE ?) AND deleted_at IS NULL LIMIT 30`,
    )
      .bind(`%${q}%`, `%${q}%`, `%${q}%`)
      .all<ItemRow>();
    for (const r of results) hits.set(r.id, { ...toHit(r), score: 1 });
  }

  // 2. semantic search (cosine over all rows with embeddings)
  const settings = await getSettings(c.env.DB);
  const provider = settings ? createProvider(settings) : null;
  if (provider?.embedding) {
    try {
      const { embedText } = await import("#ai");
      const qvec = await embedText(provider, q);
      if (qvec) {
        const top = await nearest(c.env.DB, qvec, provider.embeddingModelId!, { limit: 20 });
        const rows = await itemsByIds(c.env.DB, top.map((t) => t.id));
        const scored: Hit[] = top.flatMap((t) => {
          const r = rows.get(t.id);
          return r ? [{ ...toHit(r), score: t.score }] : [];
        });
        for (const h of scored) {
          const existing = hits.get(h.id);
          if (existing) existing.score += 0.5 * h.score; // RRF-ish fusion
          else hits.set(h.id, h);
        }
      }
    } catch {
      // semantic search unavailable, keyword results only
    }
  }

  const sorted = [...hits.values()].sort((a, b) => b.score - a.score);
  return c.json({ hits: sorted.slice(0, 30) });
});

function toHit(r: ItemRow): Hit {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    icon: r.icon,
    note: r.note,
    category: r.category,
    tags: safeTags(r.tags),
    pinned: !!r.pinned,
    clickCount: r.click_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    score: 0,
  };
}

function safeTags(t: string): string[] {
  try {
    return JSON.parse(t || "[]");
  } catch {
    return [];
  }
}
