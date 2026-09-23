import { groupBy, sortBy } from "es-toolkit";
import type { Item } from "#hooks/useItems";

export function groupByCategory(items: Item[]): [string, Item[]][] {
  const groups = groupBy(items, (item) => item.category || "未分类");
  return sortBy(Object.entries(groups), [([category]) => category]);
}
