export interface Item {
  id: number;
  name: string;
  url: string;
  icon: string;
  note: string;
  category: string;
  tags: string[];
  pinned: boolean;
  hasEmbedding: boolean;
  clickCount: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  aiSummary: string;
  httpStatus: number | null;
  checkedAt: number | null;
}

// Kept intentionally simple and in sync with the SQL approximation used to
// backfill url_norm in migrations/0002_experience.sql.
export function normalizeUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

export type AiApiMode = "chat" | "responses";

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  embeddingModel?: string;
  apiMode?: AiApiMode;
}

export interface SearchHit {
  id: number;
  name: string;
  url: string;
  note: string;
  category: string;
  tags: string[];
  score: number;
}

export * from "./import";
