import { BookmarkPlusIcon, XIcon } from "lucide-react";
import type { SavedSearch } from "@pickit/shared";
import { Button } from "#components/ui/button";
import { ScrollFade } from "#components/ScrollFade";
import { cn } from "#lib/utils";
import { m } from "#lib/i18n";

/**
 * Saved searches as a scrollable row of chips: tap to apply, × to delete.
 * "Save search" shows while a query, filter or non-default sort is active.
 */
export function SavedSearchesBar({
  list,
  activeId,
  canSave,
  onApply,
  onSave,
  onRemove,
}: {
  list: SavedSearch[];
  /** The saved search matching the current state, highlighted. */
  activeId: string | null;
  canSave: boolean;
  onApply: (search: SavedSearch) => void;
  onSave: () => void;
  onRemove: (search: SavedSearch) => void;
}) {
  if (list.length === 0 && !canSave) return null;
  return (
    <ScrollFade className="-mx-4 flex items-center gap-1.5 px-4">
      {list.map((s) => (
        <span
          key={s.id}
          className={cn(
            "group flex shrink-0 items-center rounded-full border text-xs transition-colors",
            s.id === activeId ? "border-foreground/40 bg-accent" : "bg-background hover:bg-accent/50",
          )}
        >
          <button type="button" className="py-1 ps-3 pe-1.5" onClick={() => onApply(s)}>
            {s.name}
          </button>
          <button
            type="button"
            aria-label={m.saved_search_remove({ name: s.name })}
            className="me-1 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(s)}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      {canSave && !activeId && (
        <Button variant="ghost" size="xs" className="shrink-0 rounded-full text-muted-foreground" onClick={onSave}>
          <BookmarkPlusIcon />
          {m.saved_search_save()}
        </Button>
      )}
    </ScrollFade>
  );
}
