import { useState, type RefObject } from "react";
import type { Item } from "#hooks/useItems";
import { useHotkeys } from "#hooks/useHotkeys";

/**
 * Home page shortcuts: j / k move a highlight through the visible cards (in
 * display order), Enter / o / e / p act on it, / focuses search, n adds.
 */
export function useItemKeyboardNav({
  items,
  searchRef,
  enabled,
  onOpenDetail,
  onOpenLink,
  onEdit,
  onTogglePin,
  onAdd,
}: {
  items: Item[];
  searchRef: RefObject<HTMLInputElement | null>;
  enabled: boolean;
  onOpenDetail: (item: Item) => void;
  onOpenLink: (item: Item) => void;
  onEdit: (item: Item) => void;
  onTogglePin: (item: Item) => void;
  onAdd: () => void;
}) {
  const [focusedId, setFocusedId] = useState<number | null>(null);
  // The highlight is dropped when its card is filtered out.
  const index = items.findIndex((i) => i.id === focusedId);
  const focused = index >= 0 ? items[index] : null;

  const move = (step: number) => {
    if (items.length === 0) return;
    const next = index < 0 ? (step > 0 ? 0 : items.length - 1) : Math.min(Math.max(index + step, 0), items.length - 1);
    setFocusedId(items[next].id);
  };
  const onFocused = (fn: (item: Item) => void) => () => (focused ? fn(focused) : false);

  useHotkeys(
    {
      j: () => move(1),
      k: () => move(-1),
      Enter: onFocused(onOpenDetail),
      o: onFocused(onOpenLink),
      e: onFocused(onEdit),
      p: onFocused(onTogglePin),
      "/": () => searchRef.current?.focus(),
      n: onAdd,
      Escape: () => (focused ? setFocusedId(null) : false),
    },
    enabled,
  );

  return { focusedId: focused?.id ?? null };
}
