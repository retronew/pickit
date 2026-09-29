import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "#components/ui/card";
import { StatTile } from "#components/StatTile";
import { RankBarChart } from "#components/stats/RankBarChart";
import { MonthBarChart } from "#components/stats/MonthBarChart";
import { PageLoading } from "#components/PageLoading";
import { Empty, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { m } from "#lib/i18n";
import { statsQuery } from "#lib/queries";

function truncateLabel(label: string, max = 8) {
  return label.length > max ? `${label.slice(0, max)}…` : label;
}

function ChartEmpty() {
  return (
    <Empty className="py-8">
      <EmptyHeader>
        <EmptyTitle>{m.stats_empty()}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

export function StatsPage() {
  const stats = useQuery(statsQuery).data ?? null;

  const categoryData = useMemo(
    () =>
      (stats?.byCategory ?? []).slice(0, 15).map((c) => ({
        ...c,
        label: truncateLabel(c.category || m.uncategorized()),
        value: c.count,
      })),
    [stats],
  );

  const clickData = useMemo(
    () =>
      (stats?.clickTop ?? []).slice(0, 10).map((c) => ({
        ...c,
        label: truncateLabel(c.name),
        value: c.clickCount,
      })),
    [stats],
  );

  if (!stats) {
    return <PageLoading />;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="font-heading font-semibold text-lg">{m.nav_stats()}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={m.stats_total()} value={String(stats.total)} />
        <StatTile
          label={m.stats_embedding_coverage()}
          value={`${Math.round(stats.embeddingCoverage * 100)}%`}
        />
        <StatTile
          label={m.stats_dead_links()}
          value={String(stats.deadLinks)}
        />
        <StatTile label={m.nav_trash()} value={String(stats.trash)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Left: tall category list; right: month + clicks stacked */}
        <Card>
          <CardHeader>
            <CardTitle>{m.stats_by_category()}</CardTitle>
            <CardDescription>{m.stats_by_category_hint()}</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <ChartEmpty />
            ) : (
              <RankBarChart data={categoryData} label={m.stats_count()} />
            )}
          </CardContent>
          {categoryData.length > 0 && (
            <CardFooter className="text-muted-foreground text-sm">
              {m.stats_category_total({ count: stats.byCategory.length })}
            </CardFooter>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{m.stats_by_month()}</CardTitle>
              <CardDescription>{m.stats_by_month_hint()}</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.byMonth.length === 0 ? (
                <ChartEmpty />
              ) : (
                <MonthBarChart data={stats.byMonth} />
              )}
            </CardContent>
          </Card>

          {clickData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{m.stats_top_clicked()}</CardTitle>
                <CardDescription>{m.stats_top_clicked_hint()}</CardDescription>
              </CardHeader>
              <CardContent>
                <RankBarChart data={clickData} label={m.detail_clicks()} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
