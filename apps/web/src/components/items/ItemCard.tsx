import { memo } from "react";
import { PencilIcon, PinIcon, Trash2Icon } from "lucide-react";
import type { Item } from "#hooks/useItems";
import { Favicon } from "#components/Favicon";
import { Card } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Badge } from "#components/ui/badge";
import { cn } from "#lib/utils";

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
        aria-label="选择"
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
  selectMode,
  selected,
  onToggleSelect,
}: {
  item: Item;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onTogglePin: (item: Item) => void;
  onOpenDetail?: (item: Item) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
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
            <span className="truncate">{item.name}</span>
          ) : (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                navigator.sendBeacon(`/api/items/${item.id}/visit`);
              }}
              className="truncate hover:underline"
            >
              {item.name}
            </a>
          )}
          {!selectMode && isDeadLink(item) && (
            <Badge variant="destructive" size="sm" className="shrink-0">
              失效
            </Badge>
          )}
        </div>
        {!selectMode && (
          <div
            className={cn(
              "flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
              item.pinned && "opacity-100",
            )}
          >
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={item.pinned ? "取消置顶" : "置顶"}
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
              aria-label="编辑"
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
              aria-label="删除"
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
      {item.note && (
        <p className="mt-1 text-muted-foreground text-sm whitespace-pre-line line-clamp-2">
          {item.note}
        </p>
      )}
      {(item.tags.length > 0 || item.clickCount > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {item.tags.map((t) => (
            <Badge key={t} variant="secondary" size="sm">
              {t}
            </Badge>
          ))}
          {item.clickCount > 0 && (
            <span className="ml-auto text-muted-foreground/72 text-xs">
              点击 {item.clickCount} 次
            </span>
          )}
        </div>
      )}
    </Card>
  );
});
