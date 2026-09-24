import { XIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { Badge } from "#components/ui/badge";
import { Favicon } from "#components/Favicon";
import { Empty, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import type { BatchEntry } from "#hooks/useBatchAdd";
import { m } from "#lib/i18n";

/** The accepted entries before saving; each can still be removed. */
export function BatchSummaryStep({
  entries,
  onRemove,
}: {
  entries: BatchEntry[];
  onRemove: (url: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyTitle>{m.batch_summary_empty()}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ul className="divide-y overflow-hidden rounded-xl border">
      {entries.map((entry) => (
        <li key={entry.url} className="flex animate-fade-in items-start gap-3 px-3 py-2.5">
          <Favicon url={entry.url} name={entry.form.name} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-medium text-sm">{entry.form.name}</p>
            <p className="truncate text-muted-foreground text-xs">{entry.url}</p>
            {(entry.form.category || entry.form.tags.length > 0) && (
              <div className="flex flex-wrap items-center gap-1">
                {entry.form.category && (
                  <Badge variant="outline" size="sm">
                    {entry.form.category}
                  </Badge>
                )}
                {entry.form.tags.map((t) => (
                  <Badge key={t} variant="secondary" size="sm">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            {entry.saveError && <p className="text-destructive-foreground text-xs">{entry.saveError}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={m.batch_remove()}
            className="text-muted-foreground hover:text-destructive-foreground"
            onClick={() => onRemove(entry.url)}
          >
            <XIcon />
          </Button>
        </li>
      ))}
    </ul>
  );
}
