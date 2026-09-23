import { groupBy } from "es-toolkit";
import type { Item } from "#hooks/useItems";
import { compareText } from "#lib/collate";

export function groupByCategory(items: Item[]): [string, Item[]][] {
  const groups = groupBy(items, (item) => item.category || "未分类");
  return Object.entries(groups).sort(([a], [b]) => compareText(a, b));
}
