import { EvilBarChart } from "#components/evilcharts/charts/recharts-bar-chart";
import type { ShareStats } from "#hooks/useShareStats";
import { chartColor } from "#lib/chartColor";
import { m } from "#lib/i18n";

const chartConfig = {
  page: { label: m.share_stats_page_views(), ...chartColor("var(--chart-2)") },
  rss: { label: m.share_stats_rss_fetches(), ...chartColor("var(--chart-4)") },
};

/** Daily page views and RSS fetches, stacked. */
export function ShareVisitsChart({ byDay }: { byDay: ShareStats["byDay"] }) {
  const data = byDay.map((d) => ({ ...d, label: d.day.slice(5) }));
  return (
    <EvilBarChart
      config={chartConfig}
      data={data}
      stackType="stacked"
      barRadius={4}
      className="aspect-auto h-40"
      chartProps={{ margin: { top: 8 } }}
    >
      <EvilBarChart.Grid />
      <EvilBarChart.XAxis dataKey="label" minTickGap={16} />
      <EvilBarChart.Tooltip />
      <EvilBarChart.Bar dataKey="page" />
      <EvilBarChart.Bar dataKey="rss" />
    </EvilBarChart>
  );
}
