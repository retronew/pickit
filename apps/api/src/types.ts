export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_PASSWORD: string;
  JWT_SECRET: string;
  BACKUPS?: R2Bucket;
}

export interface ItemRow {
  id: number;
  name: string;
  url: string;
  icon: string;
  note: string;
  category: string;
  tags: string;
  pinned: number;
  url_norm: string;
  click_count: number;
  last_visited_at: number | null;
  deleted_at: number | null;
  ai_summary: string;
  http_status: number | null;
  checked_at: number | null;
  /** Only present when selected explicitly; ITEM_COLUMNS leaves the blobs out. */
  embedding?: ArrayBuffer | null;
  embedding_model: string | null;
  /** 1 when the item has an embedding (from ITEM_COLUMNS). */
  has_embedding?: number;
  created_at: number;
  updated_at: number;
}

/**
 * Every items column except the vector blobs, which can be tens of KB per
 * row. Use instead of `SELECT *` so listing items stays cheap.
 */
export function itemColumns(alias = ""): string {
  const p = alias ? `${alias}.` : "";
  return [
    "id", "name", "url", "icon", "note", "category", "tags", "embedding_model",
    "created_at", "updated_at", "pinned", "deleted_at", "click_count",
    "last_visited_at", "url_norm", "ai_summary", "http_status", "checked_at",
  ]
    .map((c) => p + c)
    .concat(`(${p}embedding IS NOT NULL) AS has_embedding`)
    .join(", ");
}

export const ITEM_COLUMNS = itemColumns();
