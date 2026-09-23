import { Streamdown } from "streamdown";
import { ExternalLinkIcon } from "lucide-react";
import { Card } from "#components/ui/card";
import { Badge } from "#components/ui/badge";
import { Favicon } from "#components/Favicon";
import { cn } from "#lib/utils";

export interface SharedItem {
  name: string;
  url: string;
  icon: string;
  note: string;
  category: string;
  tags: string[];
}

/** One bookmark on a public share page; `compact` for list pages. */
export function SharedItemCard({
  item,
  title,
  compact = false,
}: {
  item: SharedItem;
  title?: string;
  compact?: boolean;
}) {
  return (
    <Card className={cn(compact ? "p-4 shadow-none before:shadow-none dark:before:shadow-none" : "p-5")}>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className={cn("flex items-center gap-2 font-medium hover:underline", !compact && "text-lg")}
      >
        <Favicon url={item.url} name={item.name} />
        <span className="min-w-0 truncate">{title || item.name}</span>
        <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
      </a>
      {item.note && (
        <div className={cn("mt-2 text-muted-foreground text-sm leading-relaxed", compact && "line-clamp-3")}>
          <Streamdown>{item.note}</Streamdown>
        </div>
      )}
      {(item.category || item.tags.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {item.category && (
            <Badge variant="outline" size="sm">
              {item.category}
            </Badge>
          )}
          {item.tags.map((t) => (
            <Badge key={t} variant="secondary" size="sm">
              {t}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
