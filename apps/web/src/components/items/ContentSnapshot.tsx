import { BookOpenIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { ReaderDialog } from "#components/items/ReaderDialog";
import { useItemContent } from "#hooks/useItemContent";
import type { Item } from "#hooks/useItems";
import { formatBytes, formatDateTime } from "#lib/format";
import { m } from "#lib/i18n";

/**
 * The saved page text of a bookmark in the detail panel: when it was captured,
 * a reader view and a refetch. Hidden when the server stores no page text.
 */
export function ContentSnapshot({ item, open }: { item: Item; open: boolean }) {
  const { content, busy, loadText, refetch } = useItemContent(item.id, open);
  if (!content?.enabled || !item.url) return null;

  const captured = content.capturedAt
    ? m.content_captured({ date: formatDateTime(content.capturedAt) })
    : "";
  const status =
    content.status === "ok"
      ? `${captured} · ${formatBytes(content.size ?? 0)}`
      : content.status === "empty"
        ? m.content_empty()
        : content.status === "failed"
          ? m.content_failed()
          : m.content_none();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{m.content_title()}</p>
        <p className="truncate text-muted-foreground text-xs">{status}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {content.status === "ok" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => ReaderDialog.call({ title: item.name, captured, loadText })}
          >
            <BookOpenIcon />
            {m.content_read()}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={refetch} loading={busy}>
          <RefreshCwIcon />
          {content.status === "" ? m.content_capture() : m.content_refetch()}
        </Button>
      </div>
      <ReaderDialog />
    </div>
  );
}
