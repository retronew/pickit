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
  /** Preview image (og:image), "" when there is none. */
  image: string;
  /** Wayback Machine snapshot, looked up once the link is found dead. */
  archiveUrl: string;
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

export * from "./ai/index";

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

export * from "./audit";
export * from "./saved-searches";
export * from "./share-stats";
