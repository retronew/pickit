import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { uniq, sortBy } from "es-toolkit";
import type { Item } from "#hooks/useItems";
import type { CategoryOption } from "#components/items/CategoryFilter";
import type { TagOption } from "#components/items/TagFilter";
import { groupByCategory } from "#lib/groupItems";

export type SortKey = "pinned" | "created" | "updated" | "name";

export const SORT_LABELS: Record<SortKey, string> = {
  pinned: "默认排序",
  created: "最近添加",
  updated: "最近更新",
  name: "按名称",
};

function inCategory(item: Item, category: string) {
  return !category || item.category === category || item.category.startsWith(`${category}/`);
}

function countBy(values: Iterable<string>) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({ value, count }));
}

/**
 * Category / tag filters (tags live in the URL), sorting and grouping.
 * With search hits, hits keep their relevance order and only get filtered.
 */
export function useItemFilters(items: Item[], hits: Item[] | null) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("pinned");
  const selectedTags = useMemo(() => uniq(searchParams.getAll("tag")), [searchParams]);

  function setTagFilter(next: string[]) {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.delete("tag");
        for (const tag of next) params.append("tag", tag);
        return params;
      },
      { replace: true },
    );
  }

  function clearFilters() {
    setCategory("");
    setTagFilter([]);
  }

  const categories = useMemo(
    () => uniq(items.map((i) => i.category).filter(Boolean)).sort(),
    [items],
  );

  // Counts include parent categories: "前端/React" also counts for "前端".
  const categoryOptions = useMemo<CategoryOption[]>(
    () =>
      countBy(
        items.flatMap((item) => {
          if (!item.category) return [];
          const parts = item.category.split("/");
          return parts.map((_, depth) => parts.slice(0, depth + 1).join("/"));
        }),
      ),
    [items],
  );

  const tagOptions = useMemo<TagOption[]>(
    () => countBy(items.flatMap((item) => [...new Set(item.tags)])),
    [items],
  );

  const allTags = useMemo(() => tagOptions.map((option) => option.value), [tagOptions]);

  const matches = (item: Item) =>
    inCategory(item, category) && selectedTags.every((tag) => item.tags.includes(tag));

  const sorted = useMemo(() => {
    const filtered = items.filter(matches);
    if (sortKey === "pinned") return filtered;
    const byKey =
      sortKey === "created"
        ? (list: Item[]) => sortBy(list, [(i) => -i.createdAt])
        : sortKey === "updated"
          ? (list: Item[]) => sortBy(list, [(i) => -i.updatedAt])
          : (list: Item[]) => sortBy(list, [(i) => i.name.toLowerCase()]);
    return [...byKey(filtered.filter((i) => i.pinned)), ...byKey(filtered.filter((i) => !i.pinned))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, category, selectedTags, sortKey]);

  const visibleItems = useMemo(
    () => (hits ? hits.filter(matches) : sorted),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hits, sorted, category, selectedTags],
  );

  const grouped = useMemo(() => groupByCategory(visibleItems), [visibleItems]);

  return {
    category,
    setCategory,
    selectedTags,
    setTagFilter,
    clearFilters,
    sortKey,
    setSortKey,
    categories,
    categoryOptions,
    tagOptions,
    allTags,
    visibleItems,
    grouped,
    hasFilters: !!category || selectedTags.length > 0,
  };
}
