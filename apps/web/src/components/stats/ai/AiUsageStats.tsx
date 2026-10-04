import { useState } from "react";
import { AI_USAGE_RANGES } from "@pickit/shared";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "#components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "#components/ui/toggle-group";
import { Empty, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { StatTile } from "#components/StatTile";
import { PageLoading } from "#components/PageLoading";
import { ShareDonutChart } from "#components/stats/ShareDonutChart";
import { AiUsageTrendChart } from "#components/stats/ai/AiUsageTrendChart";
import { AiModelList } from "#components/stats/ai/AiModelList";
import { AiUsageRetention } from "#components/stats/ai/AiUsageRetention";
import { useAiUsage } from "#hooks/useAiUsage";
import { AI_FEATURE_LABELS, formatCount, formatTokens } from "#lib/ai-usage";
import { m } from "#lib/i18n";
import { cn } from "#lib/utils";

/** The "AI usage" tab of the stats page: calls and tokens by day, model and feature. */
export function AiUsageStats() {
  const [days, setDays] = useState<number>(30);
  const { report, loading } = useAiUsage(days);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          aria-label={m.stats_tab_ai()}
          variant="outline"
          size="sm"
          value={[String(days)]}
          onValueChange={(v) => v[0] && setDays(Number(v[0]))}
        >
          {AI_USAGE_RANGES.map((d) => (
            <ToggleGroupItem key={d} value={String(d)}>
              {m.ai_usage_range_days({ days: d })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {!report ? (
        <PageLoading />
      ) : (
        <div className={cn("space-y-6 transition-opacity", loading && "opacity-60")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label={m.ai_usage_calls()} value={formatCount(report.totals.calls)} />
            <StatTile
              label={m.ai_usage_input_tokens()}
              value={formatTokens(report.totals.inputTokens)}
              hint={formatCount(report.totals.inputTokens)}
            />
            <StatTile
              label={m.ai_usage_output_tokens()}
              value={formatTokens(report.totals.outputTokens)}
              hint={formatCount(report.totals.outputTokens)}
            />
            <StatTile
              label={m.ai_usage_failed()}
              value={formatCount(report.totals.failed)}
              hint={
                report.totals.calls
                  ? m.ai_usage_failed_rate({ rate: `${Math.round((report.totals.failed / report.totals.calls) * 100)}%` })
                  : undefined
              }
            />
          </div>

          {report.totals.calls === 0 ? (
            <Empty className="py-8">
              <EmptyHeader>
                <EmptyTitle>{m.ai_usage_empty()}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{m.ai_usage_by_day()}</CardTitle>
                  <CardDescription>{m.ai_usage_by_day_hint()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <AiUsageTrendChart data={report.byDay} />
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                <Card className="min-w-0">
                  <CardHeader>
                    <CardTitle>{m.ai_usage_by_model()}</CardTitle>
                    <CardDescription>{m.ai_usage_by_model_hint()}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AiModelList data={report.byModel} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>{m.ai_usage_by_feature()}</CardTitle>
                    <CardDescription>{m.ai_usage_by_feature_hint()}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ShareDonutChart
                      data={report.byFeature.map((f) => ({
                        label: AI_FEATURE_LABELS[f.feature]?.() ?? f.feature,
                        count: f.calls,
                      }))}
                    />
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      <AiUsageRetention />
    </div>
  );
}
