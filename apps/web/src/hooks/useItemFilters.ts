import { useMemo, useState } from "react";
import { sortText } from "#lib/collate";
import { useSearchParams } from "react-router";
import { uniq } from "es-toolkit";
import type { Item } from "#hooks/useItems";
import type { CategoryOption } from "#components/items/CategoryFilter";
import type { TagOption } from "#components/items/TagFilter";
import { groupByCategory } from "#lib/groupItems";
import {
  categoryCounts,
  matchesFilters,
  sortItems,
  tagCounts,
  type SortKey,
} from "#lib/itemFilters";

export type { SortKey };

export const SORT_LABELS: Record<SortKey, string> = {
  pinned: "默认排序",
  created: "最近添加",
  updated: "最近更新",
  name: "按名称",
};

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
    () => sortText(uniq(items.map((i) => i.category).filter(Boolean))),
    [items],
  );

  const categoryOptions = useMemo<CategoryOption[]>(() => categoryCounts(items), [items]);
  const tagOptions = useMemo<TagOption[]>(() => tagCounts(items), [items]);

  const allTags = useMemo(() => tagOptions.map((option) => option.value), [tagOptions]);

  // Search hits keep their relevance order and are only filtered.
  const visibleItems = useMemo(() => {
    const matches = (item: Item) => matchesFilters(item, category, selectedTags);
    return hits ? hits.filter(matches) : sortItems(items.filter(matches), sortKey);
  }, [items, hits, category, selectedTags, sortKey]);

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
