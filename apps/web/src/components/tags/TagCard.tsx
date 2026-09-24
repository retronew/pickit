import { PencilIcon, Trash2Icon, Share2Icon } from "lucide-react";
import { Card } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Badge } from "#components/ui/badge";
import { MarqueeText } from "#components/MarqueeText";
import { m } from "#lib/i18n";

/**
 * One tag with its bookmark count and actions. Narrow (two per row on phones):
 * name on top, count + actions below. From `sm` up: all on one row.
 */
export function TagCard({
  tag,
  count,
  onOpen,
  onShare,
  onRename,
  onDelete,
}: {
  tag: string;
  count: number;
  onOpen: () => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex flex-col gap-1.5 p-3 shadow-none before:shadow-none sm:flex-row sm:items-center sm:gap-2 dark:before:shadow-none">
      <button
        type="button"
        onClick={onOpen}
        title={`#${tag}`}
        className="min-w-0 flex-1 text-left font-medium"
      >
        <MarqueeText>#{tag}</MarqueeText>
      </button>
      <div className="-mr-1 flex shrink-0 items-center gap-0.5">
        <Badge variant="secondary" size="sm" className="mr-auto sm:mr-1">
          {count}
        </Badge>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={m.tag_share()}
          title={m.tag_share_hint()}
          onClick={onShare}
        >
          <Share2Icon />
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label={m.action_rename()} onClick={onRename}>
          <PencilIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={m.action_delete()}
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive-foreground"
        >
          <Trash2Icon />
        </Button>
      </div>
    </Card>
  );
}
