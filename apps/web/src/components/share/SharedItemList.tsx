import { SharedItemCard, type SharedItem } from "#components/share/SharedItemCard";
import { groupItems, type GroupMode } from "#lib/group-items";
import { m } from "#lib/i18n";

function Grid({ items }: { items: SharedItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <SharedItemCard key={`${item.url}-${item.name}`} item={item} compact />
      ))}
    </div>
  );
}

/** The bookmarks of a shared list: all in one grid, or grouped by category / tag. */
export function SharedItemList({ items, mode }: { items: SharedItem[]; mode: GroupMode }) {
  if (mode === "flat") return <Grid items={items} />;
  const fallback = mode === "category" ? m.uncategorized() : m.public_untagged();

  return (
    <div className="space-y-6">
      {groupItems(items, mode).map((g) => (
        <section key={g.key} className="space-y-2.5">
          <h2 className="flex items-baseline gap-2 font-medium text-sm">
            <span className="truncate">{g.key ? (mode === "tag" ? `#${g.key}` : g.key) : fallback}</span>
            <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{g.items.length}</span>
          </h2>
          <Grid items={g.items} />
        </section>
      ))}
    </div>
  );
}
