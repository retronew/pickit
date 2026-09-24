import { sortBy } from "es-toolkit";
import { compareText } from "#lib/collate";
import type { Item } from "@pickit/shared";

export type SortKey = "pinned" | "created" | "updated" | "name" | "manual";

export interface FacetCount {
  value: string;
  count: number;
}

/** A category filter also matches its sub-categories ("前端" ⊃ "前端/React"). */
export function inCategory(item: Item, category: string): boolean {
  return !category || item.category === category || item.category.startsWith(`${category}/`);
}

export function matchesFilters(item: Item, category: string, tags: string[]): boolean {
  return inCategory(item, category) && tags.every((tag) => item.tags.includes(tag));
}

function countBy(values: Iterable<string>): FacetCount[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .sort(([a], [b]) => compareText(a, b))
    .map(([value, count]) => ({ value, count }));
}

/** Counts per category, where "前端/React" also counts towards "前端". */
export function categoryCounts(items: Item[]): FacetCount[] {
  return countBy(
    items.flatMap((item) => {
      if (!item.category) return [];
      const parts = item.category.split("/");
      return parts.map((_, depth) => parts.slice(0, depth + 1).join("/"));
    }),
  );
}

export function tagCounts(items: Item[]): FacetCount[] {
  return countBy(items.flatMap((item) => [...new Set(item.tags)]));
}

/**
 * Manual order: never-reordered items first (newest first, so new bookmarks
 * land on top), then by the position the user dragged them to.
 */
export function compareManual(a: Item, b: Item): number {
  if (a.position === null || b.position === null) {
    if (a.position !== b.position) return a.position === null ? -1 : 1;
    return b.createdAt - a.createdAt;
  }
  return a.position - b.position;
}

/** Pinned items stay first (except in manual order); "pinned" keeps the server order. */
export function sortItems(items: Item[], key: SortKey): Item[] {
  if (key === "pinned") return items;
  if (key === "manual") return [...items].sort(compareManual);
  const byKey =
    key === "created"
      ? (list: Item[]) => sortBy(list, [(i) => -i.createdAt])
      : key === "updated"
        ? (list: Item[]) => sortBy(list, [(i) => -i.updatedAt])
        : (list: Item[]) => sortBy(list, [(i) => i.name.toLowerCase()]);
  return [...byKey(items.filter((i) => i.pinned)), ...byKey(items.filter((i) => !i.pinned))];
}
