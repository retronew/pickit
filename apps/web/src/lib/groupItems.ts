import { groupBy } from "es-toolkit";
import type { Item } from "#hooks/useItems";
import { compareText } from "#lib/collate";
import { m } from "#lib/i18n";

export function groupByCategory(items: Item[]): [string, Item[]][] {
  const groups = groupBy(items, (item) => item.category || m.uncategorized());
  return Object.entries(groups).sort(([a], [b]) => compareText(a, b));
}
