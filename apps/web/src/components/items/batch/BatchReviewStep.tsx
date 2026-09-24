import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { Badge } from "#components/ui/badge";
import { Spinner } from "#components/ui/spinner";
import { ItemFormFields, type ItemFormPayload } from "#components/items/ItemFormFields";
import type { BatchEntry } from "#hooks/useBatchAdd";
import { cn } from "#lib/utils";
import { m } from "#lib/i18n";

export type SlideDirection = "next" | "prev";

/** Status of one entry: the user's decision first, then the analysis state. */
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
    return <span className="truncate text-warning-foreground text-xs">{m.batch_status_failed()}</span>;
  }
  return null;
}

/**
 * One entry at a time as the editable bookmark form. A pager row on top
 * (prev · position · next, status, and the accepted count that leads to the
 * summary); accept / discard live in the dialog footer. Switching slides the
 * form in from the direction of travel.
 */
export function BatchReviewStep({
  entries,
  index,
  direction,
  onNavigate,
  onUpdate,
  onShowSummary,
  categories,
  allTags,
}: {
  entries: BatchEntry[];
  index: number;
  direction: SlideDirection;
  onNavigate: (index: number) => void;
  onUpdate: (url: string, update: (form: ItemFormPayload) => ItemFormPayload) => void;
  onShowSummary: () => void;
  categories: string[];
  allTags: string[];
}) {
  const entry = entries[index];
  const accepted = entries.filter((e) => e.decision === "accepted").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={m.batch_prev()}
            disabled={index === 0}
            onClick={() => onNavigate(index - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="px-1 font-medium text-sm tabular-nums">
            {m.batch_review_position({ index: index + 1, total: entries.length })}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={m.batch_next()}
            disabled={index === entries.length - 1}
            onClick={() => onNavigate(index + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
        <div className="min-w-0">
          <EntryStatus entry={entry} />
        </div>
        <Button variant="ghost" size="sm" className="ml-auto shrink-0 text-muted-foreground" onClick={onShowSummary}>
          {m.batch_accepted_count({ count: accepted })}
          <ChevronRightIcon />
        </Button>
      </div>

      {/* Keyed on the URL so each switch remounts and replays the slide-in. */}
      <div
        key={entry.url}
        className={cn(
          "space-y-4",
          direction === "next" ? "animate-slide-from-right" : "animate-slide-from-left",
          entry.decision === "discarded" && "opacity-60",
        )}
      >
        <ItemFormFields
          value={entry.form}
          onChange={(update) => onUpdate(entry.url, update)}
          categories={categories}
          allTags={allTags}
          idPrefix="batch"
          duplicates={entry.duplicates}
        />
      </div>
    </div>
  );
}
