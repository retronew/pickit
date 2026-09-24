import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "#components/ui/chart";
import type { ShareStats } from "#hooks/useShareStats";
import { m } from "#lib/i18n";

const chartConfig = {
  page: { label: m.share_stats_page_views(), color: "var(--chart-2)" },
  rss: { label: m.share_stats_rss_fetches(), color: "var(--chart-4)" },
} satisfies ChartConfig;

/** Daily page views and RSS fetches, stacked. */
export function ShareVisitsChart({ byDay }: { byDay: ShareStats["byDay"] }) {
  const data = byDay.map((d) => ({ ...d, label: d.day.slice(5) }));
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-40 w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="page" stackId="v" fill="var(--color-page)" />
        <Bar dataKey="rss" stackId="v" fill="var(--color-rss)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
