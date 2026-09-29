import { EvilAreaChart } from "#components/evilcharts/charts/recharts-area-chart";
import type { ShareStats } from "#hooks/useShareStats";
import { chartColor } from "#lib/chartColor";
import { m } from "#lib/i18n";

const chartConfig = {
  page: { label: m.share_stats_page_views(), ...chartColor("var(--chart-2)") },
  rss: { label: m.share_stats_rss_fetches(), ...chartColor("var(--chart-4)") },
};

/** Daily page views and RSS fetches as two trend lines. */
export function ShareVisitsChart({ byDay }: { byDay: ShareStats["byDay"] }) {
  const data = byDay.map((d) => ({ ...d, label: d.day.slice(5) }));
  return (
    <EvilAreaChart
      config={chartConfig}
      data={data}
      curveType="monotone"
      className="aspect-auto h-40"
      chartProps={{ margin: { top: 8, left: 8, right: 8 } }}
    >
      <EvilAreaChart.Grid />
      <EvilAreaChart.XAxis dataKey="label" minTickGap={16} />
      <EvilAreaChart.Tooltip />
      <EvilAreaChart.Legend />
      <EvilAreaChart.Area dataKey="page" />
      <EvilAreaChart.Area dataKey="rss" />
    </EvilAreaChart>
  );
}
