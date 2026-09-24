import { useItemDetail } from "#hooks/useItemDetail";
import { useMediaQuery } from "#hooks/use-media-query";
import { Streamdown, defaultRemarkPlugins } from "streamdown";
import remarkBreaks from "remark-breaks";
import {
  ArchiveIcon,
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
import { Skeleton } from "#components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "#components/ui/table";
import { Favicon } from "#components/Favicon";
import { PreviewImage } from "#components/items/PreviewImage";
import { TranslatePanel } from "#components/items/TranslatePanel";
import { ContentSnapshot } from "#components/items/ContentSnapshot";
import { intlLocale, m } from "#lib/i18n";
import { ProjectActivityPanel } from "#components/items/ProjectActivityPanel";

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
    relatedLoading,
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
  const isPhone = useMediaQuery("max-sm");
  const isDead =
    linkStatus?.checkedAt != null && (linkStatus.httpStatus == null || linkStatus.httpStatus >= 400);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Phones: a bottom sheet within thumb reach; wider screens: the right edge. */}
      <SheetPopup
        side={isPhone ? "bottom" : "right"}
        className={isPhone ? "max-h-[85svh] rounded-t-2xl" : undefined}
      >
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
                    className="rounded-full px-1.5"
                  >
                    {linkStatus.httpStatus != null && linkStatus.httpStatus < 400
                      ? m.link_ok()
                      : m.link_dead()}
                  </Badge>
                )}
                {isDead && linkStatus.archiveUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<a href={linkStatus.archiveUrl} target="_blank" rel="noreferrer" />}
                  >
                    <ArchiveIcon />
                    {m.link_archive()}
                  </Button>
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
              <PreviewImage src={item.image} className="aspect-video w-full" />
              {item.note && (
                <div className="text-sm leading-relaxed [&_a]:underline [&_code]:text-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-2">
                  <Streamdown remarkPlugins={NOTE_REMARK_PLUGINS}>{item.note}</Streamdown>
                </div>
              )}

              <TranslatePanel item={item} onChanged={onChanged} />

              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.map((t) => (
                    <Badge key={t} variant="secondary" size="sm">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              <ProjectActivityPanel item={item} onChanged={onChanged} />

              <ContentSnapshot item={item} open={open} />

              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableBody>
                    {[
                      [m.field_category(), item.category || m.uncategorized()],
                      [m.detail_clicks(), item.clickCount],
                      [m.detail_created(), formatDate(item.createdAt)],
                      [m.detail_updated(), formatDate(item.updatedAt)],
                    ].map(([label, value]) => (
                      <TableRow key={String(label)} className="hover:bg-transparent">
                        <TableCell className="w-28 bg-muted/40 text-muted-foreground">
                          {label}
                        </TableCell>
                        <TableCell className="tabular-nums">{value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

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
                {summary ? (
                  <p className="animate-fade-in rounded-lg bg-muted/60 p-3 text-muted-foreground text-sm leading-relaxed">
                    {summary}
                  </p>
                ) : (
                  <p className="rounded-lg border border-dashed p-3 text-center text-muted-foreground text-sm">
                    {m.detail_summary_empty()}
                  </p>
                )}
              </div>

              {relatedLoading ? (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">{m.detail_related()}</h3>
                  <div className="space-y-1" aria-busy="true" aria-label={m.common_loading()}>
                    {Array.from({ length: 3 }, (_, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                        <Skeleton className="size-4 shrink-0 rounded-sm" />
                        <Skeleton className="h-4" style={{ width: `${56 - i * 12}%` }} />
                        <Skeleton className="ml-auto h-3 w-12" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : related.length > 0 && (
                <div className="animate-fade-in space-y-2">
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
            <SheetFooter className="max-sm:grid max-sm:grid-cols-4 max-sm:px-4 max-sm:py-3 max-sm:[&>button]:h-auto max-sm:[&>button]:flex-col max-sm:[&>button]:gap-1 max-sm:[&>button]:px-1 max-sm:[&>button]:py-2 max-sm:[&>button]:text-xs">
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
