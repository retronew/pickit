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
  embedding: ArrayBuffer | null;
  embedding_model: string | null;
  created_at: number;
  updated_at: number;
}
