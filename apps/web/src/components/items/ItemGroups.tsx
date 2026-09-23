import type { Item } from "#hooks/useItems";
import { ItemCard } from "#components/items/ItemCard";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "#components/ui/empty";
import { cn } from "#lib/utils";

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

/** Items grouped by category, or the empty state. */
export function ItemGroups({ grouped, filtered, dimmed, selectMode, selectedIds, ...handlers }: Props) {
  if (grouped.length === 0) {
    return (
      <Empty className="animate-fade-in">
        <EmptyHeader>
          <EmptyTitle>{filtered ? "没有符合条件的收藏" : "还没有收藏"}</EmptyTitle>
          <EmptyDescription>
            {filtered
              ? "试试其他关键词，或清除筛选条件。"
              : "点右上角「添加」；也可以粘贴一批网址批量导入。"}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className={cn("animate-fade-in space-y-5 transition-opacity", dimmed && "opacity-60")}>
      {grouped.map(([cat, list]) => (
        <section key={cat}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {cat} · {list.length}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {list.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                selectMode={selectMode}
                selected={selectedIds.has(item.id)}
                {...handlers}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
