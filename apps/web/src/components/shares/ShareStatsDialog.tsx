import { useEffect, useState } from "react";
import { createCallable } from "react-call";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
} from "#components/ui/dialog";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "#components/ui/chart";
import { Skeleton } from "#components/ui/skeleton";
import { Badge } from "#components/ui/badge";
import { useShareStats, type ShareStats } from "#hooks/useShareStats";
import { formatCountry, formatDateTime } from "#lib/format";
import { m } from "#lib/i18n";

const chartConfig = {
  page: { label: m.share_stats_page_views(), color: "var(--chart-2)" },
  rss: { label: m.share_stats_rss_fetches(), color: "var(--chart-4)" },
} satisfies ChartConfig;

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-heading font-semibold text-xl">{value}</p>
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="font-medium text-sm">{title}</p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-xs">{m.share_stats_none()}</p>
      ) : (
        rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">{r.count}</span>
          </div>
        ))
      )}
    </div>
  );
}

function StatsBody({ stats }: { stats: ShareStats }) {
  const data = stats.byDay.map((d) => ({ ...d, label: d.day.slice(5) }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Tile label={m.share_stats_total()} value={String(stats.total)} />
        <Tile label={m.share_stats_last30()} value={String(stats.last30)} />
        <Tile
          label={m.share_stats_last_visit()}
          value={stats.lastViewedAt ? formatDateTime(stats.lastViewedAt) : "—"}
        />
      </div>

      <ChartContainer config={chartConfig} className="aspect-auto h-40 w-full">
        <BarChart accessibilityLayer data={data} margin={{ top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="page" stackId="v" fill="var(--color-page)" />
          <Bar dataKey="rss" stackId="v" fill="var(--color-rss)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>

      <div className="grid gap-4 sm:grid-cols-2">
        <TopList
          title={m.share_stats_referrers()}
          rows={stats.referrers.map((r) => ({ label: r.host, count: r.count }))}
        />
        <TopList
          title={m.share_stats_countries()}
          rows={stats.countries.map((r) => ({ label: formatCountry(r.country), count: r.count }))}
        />
      </div>

      <div className="space-y-1.5">
        <p className="font-medium text-sm">{m.share_stats_recent()}</p>
        {stats.recent.length === 0 ? (
          <p className="text-muted-foreground text-xs">{m.share_stats_none()}</p>
        ) : (
          <ul className="divide-y text-sm">
            {stats.recent.map((v, i) => (
              <li key={i} className="flex items-center gap-2 py-1.5">
                <span className="shrink-0 text-muted-foreground tabular-nums">{formatDateTime(v.at)}</span>
                {v.kind === "rss" && <Badge size="sm" variant="outline">RSS</Badge>}
                <span className="min-w-0 flex-1 truncate">{v.referrer || m.share_stats_direct()}</span>
                {v.country && <span className="shrink-0 text-muted-foreground">{formatCountry(v.country)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
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
