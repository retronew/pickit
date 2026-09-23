import { sortBy } from "es-toolkit";
import type { Item } from "@pickit/shared";

export type SortKey = "pinned" | "created" | "updated" | "name";

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
    .sort(([a], [b]) => a.localeCompare(b))
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

/** Pinned items stay first; "pinned" keeps the server order. */
export function sortItems(items: Item[], key: SortKey): Item[] {
  if (key === "pinned") return items;
  const byKey =
    key === "created"
      ? (list: Item[]) => sortBy(list, [(i) => -i.createdAt])
      : key === "updated"
        ? (list: Item[]) => sortBy(list, [(i) => -i.updatedAt])
        : (list: Item[]) => sortBy(list, [(i) => i.name.toLowerCase()]);
  return [...byKey(items.filter((i) => i.pinned)), ...byKey(items.filter((i) => !i.pinned))];
}
