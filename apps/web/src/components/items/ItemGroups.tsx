import { useCallback, useMemo, useState } from "react";
import type { Item } from "#hooks/useItems";
import { ItemCard } from "#components/items/ItemCard";
import { ItemActionsMenu, type ItemActionsTarget } from "#components/items/ItemActionsMenu";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "#components/ui/empty";
import { WindowVirtualList } from "#components/WindowVirtualList";
import { toItemRows } from "#lib/item-rows";
import { cn } from "#lib/utils";
import { m } from "#lib/i18n";

const COLUMNS = 2;

interface Props {
  grouped: [string, Item[]][];
  filtered: boolean;
  dimmed: boolean;
  selectMode: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onTogglePin: (item: Item) => void;
  onOpenDetail: (item: Item) => void;
}

/**
 * Items grouped by category, or the empty state. Virtualized against the
 * window scroll: only rows near the viewport are mounted, since a library of
 * 600+ cards made the page slow to mount and scroll.
 */
export function ItemGroups({ grouped, filtered, dimmed, selectMode, selectedIds, ...handlers }: Props) {
  const [actionsTarget, setActionsTarget] = useState<ItemActionsTarget | null>(null);
  // Stable so the memoized cards don't re-render when the menu opens.
  const openActions = useCallback((item: Item, anchor: HTMLElement) => setActionsTarget({ item, anchor }), []);
  const rows = useMemo(() => toItemRows(grouped, COLUMNS), [grouped]);

  if (grouped.length === 0) {
    return (
      <Empty className="animate-fade-in">
        <EmptyHeader>
          <EmptyTitle>{filtered ? m.items_empty_filtered() : m.items_empty()}</EmptyTitle>
          <EmptyDescription>
            {filtered
              ? m.items_empty_filtered_hint()
              : m.items_empty_hint()}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className={cn("animate-fade-in transition-opacity", dimmed && "opacity-60")}>
      <WindowVirtualList
        rows={rows}
        getKey={(row) => row.key}
        estimateSize={(row) => (row.kind === "header" ? 32 : 104)}
        renderRow={(row) =>
          row.kind === "header" ? (
            <h2
              className={cn(
                "pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                !row.first && "pt-3",
              )}
            >
              {row.category} · {row.count}
            </h2>
          ) : (
            <div className="grid grid-cols-2 gap-2 pb-2">
              {row.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  selectMode={selectMode}
                  selected={selectedIds.has(item.id)}
                  onOpenActions={openActions}
                  {...handlers}
                />
              ))}
            </div>
          )
        }
      />
      <ItemActionsMenu
        target={actionsTarget}
        onClose={() => setActionsTarget(null)}
        onEdit={handlers.onEdit}
        onDelete={handlers.onDelete}
        onTogglePin={handlers.onTogglePin}
      />
    </div>
  );
}
