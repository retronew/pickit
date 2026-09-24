import type { Item } from "#hooks/useItems";
import { chunk } from "#lib/chunk";

/** One virtualized row: a category heading, or up to `columns` cards. */
export type ItemRow =
  | { kind: "header"; key: string; category: string; count: number; first: boolean }
  | { kind: "cards"; key: string; items: Item[] };

/** Flattens category groups into heading + card rows for a virtual list. */
export function toItemRows(grouped: [string, Item[]][], columns: number): ItemRow[] {
  const rows: ItemRow[] = [];
  grouped.forEach(([category, list], g) => {
    rows.push({ kind: "header", key: `h:${category}`, category, count: list.length, first: g === 0 });
    for (const items of chunk(list, columns)) rows.push({ kind: "cards", key: `r:${items[0].id}`, items });
  });
  return rows;
}
