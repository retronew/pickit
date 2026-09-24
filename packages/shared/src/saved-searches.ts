// Saved searches: a named query + filters + sort, stored server-side so they
// follow the user across devices.

export const SAVED_SEARCH_SORTS = ["pinned", "created", "updated", "name"] as const;
export type SavedSearchSort = (typeof SAVED_SEARCH_SORTS)[number];

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  category: string;
  tags: string[];
  sort: SavedSearchSort;
}

export const MAX_SAVED_SEARCHES = 30;
const MAX_NAME = 40;
const MAX_TEXT = 200;
const MAX_TAGS = 20;

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/**
 * Keeps the well-formed entries of untrusted input: a name is required, ids
 * must be unique, strings are trimmed and capped, unknown sorts fall back to
 * the default. At most MAX_SAVED_SEARCHES entries.
 */
export function sanitizeSavedSearches(input: unknown): SavedSearch[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: SavedSearch[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = text(r.id, 64);
    const name = text(r.name, MAX_NAME);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      query: text(r.query, MAX_TEXT),
      category: text(r.category, MAX_TEXT),
      tags: Array.isArray(r.tags)
        ? [...new Set(r.tags.map((t) => text(t, MAX_TEXT)).filter(Boolean))].slice(0, MAX_TAGS)
        : [],
      sort: SAVED_SEARCH_SORTS.includes(r.sort as SavedSearchSort) ? (r.sort as SavedSearchSort) : "pinned",
    });
    if (out.length === MAX_SAVED_SEARCHES) break;
  }
  return out;
}
