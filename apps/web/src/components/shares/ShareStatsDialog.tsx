import { useEffect, useState } from "react";
import { createCallable } from "react-call";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
} from "#components/ui/dialog";
import { Skeleton } from "#components/ui/skeleton";
import { StatTile } from "#components/StatTile";
import { ShareVisitsChart } from "#components/shares/ShareVisitsChart";
import { RecentVisitsTable, TopTable } from "#components/shares/ShareStatsTables";
import { useShareStats, type ShareStats } from "#hooks/useShareStats";
import { formatCountry, formatDateTime, formatRelative } from "#lib/format";
import { m } from "#lib/i18n";

function StatsBody({ stats }: { stats: ShareStats }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile compact label={m.share_stats_total()} value={String(stats.total)} />
        <StatTile compact label={m.share_stats_last30()} value={String(stats.last30)} />
        <StatTile compact label={m.share_stats_visitors30()} value={String(stats.visitors30)} />
        <StatTile
          compact
          label={m.share_stats_last_visit()}
          value={stats.lastViewedAt ? formatRelative(stats.lastViewedAt) : "—"}
          hint={stats.lastViewedAt ? formatDateTime(stats.lastViewedAt) : undefined}
        />
      </div>

      <ShareVisitsChart byDay={stats.byDay} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TopTable
          title={m.share_stats_referrers()}
          column={m.share_stats_col_source()}
          rows={stats.referrers.map((r) => ({ label: r.host, count: r.count }))}
        />
        <TopTable
          title={m.share_stats_countries()}
          column={m.share_stats_col_region()}
          rows={stats.countries.map((r) => ({ label: formatCountry(r.country), count: r.count }))}
        />
      </div>

      <RecentVisitsTable visits={stats.recent} />
      <p className="text-muted-foreground text-xs">{m.share_stats_repeat_hint()}</p>
    </div>
  );
}

/** Visit statistics of one share link. */
export const ShareStatsDialog = createCallable<{ slug: string; title: string }, void>(({ slug, title, call }) => {
  const [entered, setEntered] = useState(false);
  const { stats, error } = useShareStats(slug);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && call.end()}>
      <DialogPopup className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{m.share_stats_title()}</DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {error ? (
            <p className="text-muted-foreground text-sm">{m.share_stats_failed()}</p>
          ) : stats ? (
            <StatsBody stats={stats} />
          ) : (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}, 200);
