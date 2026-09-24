import { memo } from "react";
import { EllipsisIcon, PencilIcon, PinIcon, Trash2Icon } from "lucide-react";
import type { Item } from "#hooks/useItems";
import { Favicon } from "#components/Favicon";
import { PreviewImage } from "#components/items/PreviewImage";
import { Card } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Badge } from "#components/ui/badge";
import { cn } from "#lib/utils";
import { m } from "#lib/i18n";
import { MarqueeText } from "#components/MarqueeText";
import { activityLevel } from "@pickit/shared";
import { ActivityBadge } from "#components/items/ActivityBadge";
import { isUnmaintained } from "#lib/activity";

function isDeadLink(item: Item): boolean {
  return item.checkedAt != null && (item.httpStatus == null || item.httpStatus >= 400);
}

// A plain native checkbox instead of the Base UI Checkbox used elsewhere:
// entering select mode mounts one of these per visible item (600+), and the
// Base UI version's extra hooks (hidden-input sync, focus handling, id
// generation) made that mount noticeably slow at that scale. A native
// checkbox does the same job at a fraction of the cost.
function SelectionCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <span className="has-[:checked]:border-primary has-[:checked]:bg-primary relative inline-flex size-4.5 shrink-0 items-center justify-center rounded-[.25rem] border border-input bg-background shadow-xs/5 sm:size-4 dark:not-has-[:checked]:bg-input/32">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        onClick={(e) => e.stopPropagation()}
        aria-label={m.action_select()}
        className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0"
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none size-3.5 text-primary-foreground opacity-0 peer-checked:opacity-100 sm:size-3"
        fill="none"
        height="24"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
        viewBox="0 0 24 24"
        width="24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
      </svg>
    </span>
  );
}

export const ItemCard = memo(function ItemCard({
  item,
  onEdit,
  onDelete,
  onTogglePin,
  onOpenDetail,
  onOpenActions,
  selectMode,
  selected,
  focused,
  onToggleSelect,
}: {
  item: Item;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onTogglePin: (item: Item) => void;
  onOpenDetail?: (item: Item) => void;
  /** Phones: open the shared pin / edit / delete menu at `anchor`. */
  onOpenActions?: (item: Item, anchor: HTMLElement) => void;
  selectMode?: boolean;
  selected?: boolean;
  /** Highlighted by keyboard navigation. */
  focused?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  const level = activityLevel(item.activity);
  return (
    <Card
      onClick={() =>
        selectMode ? onToggleSelect?.(item.id) : onOpenDetail?.(item)
      }
      className={cn(
        "group p-3 shadow-none before:shadow-none transition-colors hover:border-ring/40 dark:before:shadow-none",
        item.pinned && "border-ring/40",
        (selectMode || onOpenDetail) && "cursor-pointer",
        selected && "border-ring/60 bg-accent/40",
        focused && "ring-2 ring-ring/60 ring-offset-1 ring-offset-background",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          {selectMode && (
            <SelectionCheckbox
              checked={!!selected}
              onChange={() => onToggleSelect?.(item.id)}
            />
          )}
          {/* Favicon stays in the same tree slot across selectMode toggles
              so React patches it in place instead of tearing down and
              recreating the <img> (and re-decoding it) for every card. */}
          <Favicon url={item.url} name={item.name} />
          {selectMode ? (
            <MarqueeText>{item.name}</MarqueeText>
          ) : (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                navigator.sendBeacon(`/api/items/${item.id}/visit`);
              }}
              className="min-w-0 hover:underline"
            >
              <MarqueeText>{item.name}</MarqueeText>
            </a>
          )}
          {!selectMode && isDeadLink(item) && (
            <Badge variant="destructive" size="sm" className="shrink-0 rounded-full px-1.5">
              {m.item_dead()}
            </Badge>
          )}
          {/* Only a warning here: a GitHub / npm project that looks unmaintained. */}
          {!selectMode && level && isUnmaintained(level) && <ActivityBadge level={level} />}
        </div>
        {/* Phones: no room for three buttons; a pinned mark plus a shared actions menu. */}
        {!selectMode && (
          <div className="-my-0.5 -mr-1 flex shrink-0 items-center sm:hidden">
            {item.pinned && <PinIcon aria-hidden className="size-3.5 fill-current" />}
            {onOpenActions && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={m.field_actions()}
                className="text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenActions(item, e.currentTarget);
                }}
              >
                <EllipsisIcon />
              </Button>
            )}
          </div>
        )}
        {!selectMode && (
          <div
            className={cn(
              "flex shrink-0 items-center gap-0.5 opacity-0 max-sm:hidden transition-opacity group-hover:opacity-100 pointer-coarse:opacity-100",
              item.pinned && "opacity-100",
            )}
          >
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={item.pinned ? m.action_unpin() : m.action_pin()}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(item);
              }}
              className={item.pinned ? "text-foreground" : "text-muted-foreground"}
            >
              <PinIcon className={item.pinned ? "fill-current" : undefined} />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={m.action_edit()}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
            >
              <PencilIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={m.action_delete()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              className="text-muted-foreground hover:text-destructive-foreground"
            >
              <Trash2Icon />
            </Button>
          </div>
        )}
      </div>
      {(item.note || item.image) && (
        <div className="mt-1 flex items-start gap-3">
          <p className="min-w-0 flex-1 text-muted-foreground text-xs whitespace-pre-line line-clamp-2 sm:text-sm">
            {item.note}
          </p>
          {/* Wider screens only: a two-column phone card has no room for it. */}
          <PreviewImage src={item.image} className="aspect-video w-20 shrink-0 max-sm:hidden" />
        </div>
      )}
      {(item.tags.length > 0 || item.clickCount > 0) && (
        <div className="mt-2 flex items-center gap-1 overflow-hidden max-sm:mask-r-from-[calc(100%-1rem)] sm:flex-wrap">
          {item.tags.map((t) => (
            <Badge key={t} variant="secondary" size="sm" className="shrink-0">
              {t}
            </Badge>
          ))}
          {item.clickCount > 0 && (
            <span className="ml-auto text-muted-foreground/72 text-xs max-sm:hidden">
              {m.item_clicks({ count: item.clickCount })}
            </span>
          )}
        </div>
      )}
    </Card>
  );
});
