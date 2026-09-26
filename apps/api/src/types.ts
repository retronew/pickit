export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  BACKUPS?: R2Bucket;
  /** Optional: Cloudflare Browser Rendering, for page text as Markdown. */
  BROWSER?: BrowserRun;
  /** Better Auth: secret for signing sessions (`wrangler secret put`). */
  BETTER_AUTH_SECRET: string;
  /** Public origin, e.g. https://pickit.example.com (OAuth callbacks live under it). */
  BETTER_AUTH_URL?: string;
  /** Emails allowed to sign in, comma separated. Everyone else is rejected. */
  ALLOWED_EMAILS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  /** Optional: raises the GitHub API limit for project activity checks. */
  GITHUB_TOKEN?: string;
  /** Local dev only: "1" skips sign-in. Ignored unless BETTER_AUTH_URL is localhost. */
  DEV_AUTH_BYPASS?: string;
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
  image: string;
  preview_checked_at: number | null;
  archive_url: string;
  /** Manual order within the category; null = never reordered. */
  position: number | null;
  /** Page text snapshot (text in R2): "" never tried, "ok", "empty", "failed". */
  content_status: string;
  content_at: number | null;
  content_size: number | null;
  /** JSON ProjectActivity of a GitHub / npm bookmark; "" = none. */
  activity: string;
  activity_at: number | null;
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
    "image", "preview_checked_at", "archive_url", "position",
    "content_status", "content_at", "content_size", "activity", "activity_at",
  ]
    .map((c) => p + c)
    .concat(`(${p}embedding IS NOT NULL) AS has_embedding`)
    .join(", ");
}

export const ITEM_COLUMNS = itemColumns();
