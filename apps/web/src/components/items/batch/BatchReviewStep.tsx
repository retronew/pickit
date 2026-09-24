import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { Badge } from "#components/ui/badge";
import { Spinner } from "#components/ui/spinner";
import { ItemFormFields, type ItemFormPayload } from "#components/items/ItemFormFields";
import type { BatchEntry, Decision } from "#hooks/useBatchAdd";
import { cn } from "#lib/utils";
import { m } from "#lib/i18n";

export type SlideDirection = "next" | "prev";

/** Status of one entry: analysis state first, then the user's decision. */
function EntryStatus({ entry }: { entry: BatchEntry }) {
  if (entry.decision === "accepted") {
    return <Badge variant="success" size="sm" className="rounded-full px-1.5">{m.batch_status_accepted()}</Badge>;
  }
  if (entry.decision === "discarded") {
    return <Badge variant="secondary" size="sm" className="rounded-full px-1.5">{m.batch_status_discarded()}</Badge>;
  }
  if (entry.status === "analyzing") {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <Spinner className="size-3.5" />
        {m.batch_status_analyzing()}
      </span>
    );
  }
  if (entry.status === "failed") {
    return <span className="text-warning-foreground text-xs">{m.batch_status_failed()}</span>;
  }
  return null;
}

/**
 * One entry at a time as the editable bookmark form, with prev / next
 * (side buttons on wider screens, a bottom bar on phones) and accept /
 * discard. Switching slides the form in from the direction of travel.
 */
export function BatchReviewStep({
  entries,
  index,
  direction,
  onNavigate,
  onUpdate,
  onDecide,
  categories,
  allTags,
}: {
  entries: BatchEntry[];
  index: number;
  direction: SlideDirection;
  onNavigate: (index: number) => void;
  onUpdate: (url: string, update: (form: ItemFormPayload) => ItemFormPayload) => void;
  onDecide: (url: string, decision: Decision) => void;
  categories: string[];
  allTags: string[];
}) {
  const entry = entries[index];
  const hasPrev = index > 0;
  const hasNext = index < entries.length - 1;
  const counts = {
    accepted: entries.filter((e) => e.decision === "accepted").length,
    discarded: entries.filter((e) => e.decision === "discarded").length,
  };

  const sideButton = (dir: SlideDirection) => (
    <Button
      variant="outline"
      size="icon"
      className="shrink-0 rounded-full max-sm:hidden"
      aria-label={dir === "prev" ? m.batch_prev() : m.batch_next()}
      disabled={dir === "prev" ? !hasPrev : !hasNext}
      onClick={() => onNavigate(index + (dir === "prev" ? -1 : 1))}
    >
      {dir === "prev" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </Button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium tabular-nums">
          {m.batch_review_position({ index: index + 1, total: entries.length })}
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {m.batch_review_counts({ ...counts, pending: entries.length - counts.accepted - counts.discarded })}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {sideButton("prev")}
        {/* Keyed on the URL so each switch remounts and replays the slide-in. */}
        <div
          key={entry.url}
          className={cn(
            "min-w-0 flex-1 space-y-4 rounded-xl border p-4",
            direction === "next" ? "animate-slide-from-right" : "animate-slide-from-left",
            entry.decision === "discarded" && "opacity-60",
          )}
        >
          <div className="flex min-h-5 items-center justify-end">
            <EntryStatus entry={entry} />
          </div>
          <ItemFormFields
            value={entry.form}
            onChange={(update) => onUpdate(entry.url, update)}
            categories={categories}
            allTags={allTags}
            idPrefix="batch"
            duplicates={entry.duplicates}
          />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              className="text-destructive-foreground"
              disabled={entry.decision === "discarded"}
              onClick={() => onDecide(entry.url, "discarded")}
            >
              <XIcon />
              {m.batch_discard()}
            </Button>
            <Button
              disabled={!entry.form.name.trim() || entry.decision === "accepted"}
              onClick={() => onDecide(entry.url, "accepted")}
            >
              <CheckIcon />
              {m.batch_accept()}
            </Button>
          </div>
        </div>
        {sideButton("next")}
      </div>

      {/* Phones: no room beside the form, so prev / next sit below it. */}
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        <Button variant="ghost" size="sm" disabled={!hasPrev} onClick={() => onNavigate(index - 1)}>
          <ChevronLeftIcon />
          {m.batch_prev()}
        </Button>
        <Button variant="ghost" size="sm" disabled={!hasNext} onClick={() => onNavigate(index + 1)}>
          {m.batch_next()}
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
