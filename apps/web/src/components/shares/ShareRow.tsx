import { BarChart3Icon, PencilIcon, RssIcon, Trash2Icon } from "lucide-react";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { CopyButton } from "#components/CopyButton";
import { SHARE_TYPE_LABELS, rssUrl, shareSubject, shareUrl, type Share } from "#lib/shares";
import { formatDate } from "#lib/format";
import { m } from "#lib/i18n";

interface Props {
  share: Share;
  onStats: () => void;
  onRename: () => void;
  onRevoke: () => void;
}

/** One share link on the shares page: what it is, how often it's opened, actions. */
export function ShareRow({ share: s, onStats, onRename, onRevoke }: Props) {
  const subject = shareSubject(s);
  const meta = [
    subject !== s.title ? subject : "",
    m.shares_created_on({ date: formatDate(s.createdAt) }),
    s.lastViewedAt ? m.shares_last_visit({ date: formatDate(s.lastViewedAt) }) : "",
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-2 py-2.5 hover:bg-accent/50 sm:flex-nowrap">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Badge variant={s.type === "item" ? "secondary" : "info"} size="sm" className="mt-0.5 shrink-0">
          {SHARE_TYPE_LABELS[s.type] ?? s.type}
        </Badge>
        <div className="min-w-0">
          <a
            href={`/s/${s.slug}`}
            target="_blank"
            rel="noreferrer"
            className="block truncate font-medium text-sm underline-offset-2 hover:underline"
          >
            {s.title || s.value}
          </a>
          <p className="truncate text-muted-foreground text-xs">{meta.join(" · ")}</p>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" size="sm" onClick={onStats} title={m.share_stats_title()} className="tabular-nums">
          <BarChart3Icon />
          {m.shares_views({ count: s.viewCount })}
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label={m.shares_rename()} title={m.shares_rename()} onClick={onRename}>
          <PencilIcon />
        </Button>
        {s.type !== "item" && (
          <CopyButton
            text={rssUrl(s.slug)}
            toast={m.shares_rss_copied()}
            icon={<RssIcon />}
            aria-label={m.shares_copy_rss()}
            title={m.shares_copy_rss()}
          />
        )}
        <CopyButton text={shareUrl(s.slug)} toast={m.share_link_copied()} aria-label={m.shares_copy_link()} />
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={m.shares_revoke()}
          title={m.shares_revoke()}
          onClick={onRevoke}
          className="text-muted-foreground hover:text-destructive-foreground"
        >
          <Trash2Icon />
        </Button>
      </div>
    </div>
  );
}
