import { useItemDetail } from "#hooks/useItemDetail";
import { Streamdown, defaultRemarkPlugins } from "streamdown";
import remarkBreaks from "remark-breaks";
import {
  PencilIcon,
  PinIcon,
  SparklesIcon,
  Trash2Icon,
  ExternalLinkIcon,
  LinkIcon,
  Share2Icon,
} from "lucide-react";
import type { Item } from "@pickit/shared";
import {
  Sheet,
  SheetPopup,
  SheetHeader,
  SheetTitle,
  SheetPanel,
  SheetFooter,
} from "#components/ui/sheet";
import { Button } from "#components/ui/button";
import { Badge } from "#components/ui/badge";
import { Favicon } from "#components/Favicon";
import { intlLocale, m } from "#lib/i18n";

// Single newlines in a note render as line breaks, like they were typed.
const NOTE_REMARK_PLUGINS = [...Object.values(defaultRemarkPlugins), remarkBreaks];

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(intlLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ItemDetailSheet({
  item,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onTogglePin,
  onChanged,
  onOpenRelated,
}: {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onChanged: () => void;
  onOpenRelated: (item: Item) => void;
}) {
  const {
    related,
    summary,
    summarizing,
    linkStatus,
    checking,
    sharing,
    shared,
    checkLinkNow,
    summarize,
    share,
  } = useItemDetail(item, open, onChanged);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPopup>
        {item && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 pr-8">
                <Favicon url={item.url} name={item.name} />
                <span className="truncate">{item.name}</span>
              </SheetTitle>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => navigator.sendBeacon(`/api/items/${item.id}/visit`)}
                className="flex items-center gap-1 truncate text-muted-foreground text-sm hover:underline"
              >
                {item.url}
                <ExternalLinkIcon className="size-3.5 shrink-0" />
              </a>
              <div className="flex items-center gap-2 pt-0.5">
                {linkStatus?.checkedAt != null && (
                  <Badge
                    variant={
                      linkStatus.httpStatus != null && linkStatus.httpStatus < 400
                        ? "success"
                        : "destructive"
                    }
                    size="sm"
                  >
                    {linkStatus.httpStatus != null && linkStatus.httpStatus < 400
                      ? m.link_ok()
                      : m.link_dead()}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={checkLinkNow}
                  loading={checking}
                >
                  <LinkIcon />
                  {m.link_check()}
                </Button>
              </div>
            </SheetHeader>
            <SheetPanel className="space-y-5">
              {item.note && (
                <div className="text-sm leading-relaxed [&_a]:underline [&_code]:text-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-2">
                  <Streamdown remarkPlugins={NOTE_REMARK_PLUGINS}>{item.note}</Streamdown>
                </div>
              )}

              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.map((t) => (
                    <Badge key={t} variant="secondary" size="sm">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">{m.field_category()}</dt>
                <dd>{item.category || m.uncategorized()}</dd>
                <dt className="text-muted-foreground">{m.detail_clicks()}</dt>
                <dd>{item.clickCount}</dd>
                <dt className="text-muted-foreground">{m.detail_created()}</dt>
                <dd>{formatDate(item.createdAt)}</dd>
                <dt className="text-muted-foreground">{m.detail_updated()}</dt>
                <dd>{formatDate(item.updatedAt)}</dd>
              </dl>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">{m.detail_summary()}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={summarize}
                    loading={summarizing}
                  >
                    <SparklesIcon />
                    {summary ? m.detail_regenerate() : m.detail_generate()}
                  </Button>
                </div>
                {summary && (
                  <p className="rounded-lg bg-muted/60 p-3 text-muted-foreground text-sm leading-relaxed">
                    {summary}
                  </p>
                )}
              </div>

              {related.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">{m.detail_related()}</h3>
                  <div className="space-y-1">
                    {related.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onOpenRelated(r)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        <Favicon url={r.url} name={r.name} />
                        <span className="truncate">{r.name}</span>
                        <span className="ml-auto shrink-0 text-muted-foreground text-xs">
                          {r.category}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </SheetPanel>
            <SheetFooter>
              <Button variant="outline" onClick={share} loading={sharing}>
                <Share2Icon />
                {shared ? m.detail_link_copied() : m.action_share()}
              </Button>
              <Button
                variant="outline"
                onClick={onTogglePin}
                className={item.pinned ? "text-foreground" : undefined}
              >
                <PinIcon className={item.pinned ? "fill-current" : undefined} />
                {item.pinned ? m.action_unpin() : m.action_pin()}
              </Button>
              <Button variant="outline" onClick={onEdit}>
                <PencilIcon />
                {m.action_edit()}
              </Button>
              <Button
                variant="outline"
                onClick={onDelete}
                className="text-destructive-foreground"
              >
                <Trash2Icon />
                {m.action_delete()}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetPopup>
    </Sheet>
  );
}
