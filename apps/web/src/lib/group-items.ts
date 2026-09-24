export type GroupMode = "flat" | "category" | "tag";

export interface ItemGroup<T> {
  /** The category or tag; "" for items without one. */
  key: string;
  items: T[];
}

/**
 * Groups items by category or by tag, keeping their order within a group.
 * An item with several tags shows up in each of them. Groups are ordered
 * by size, then name; the "" group (uncategorized / untagged) comes last.
 */
export function groupItems<T extends { category: string; tags: string[] }>(
  items: T[],
  mode: Exclude<GroupMode, "flat">,
): ItemGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const keys = mode === "category" ? [item.category] : item.tags.length ? item.tags : [""];
    for (const key of keys) {
      const list = groups.get(key);
      if (list) list.push(item);
      else groups.set(key, [item]);
    }
  }
  return [...groups]
    .map(([key, items]) => ({ key, items }))
    .sort((a, b) => {
      if (!a.key !== !b.key) return a.key ? -1 : 1;
      return b.items.length - a.items.length || a.key.localeCompare(b.key);
    });
}
