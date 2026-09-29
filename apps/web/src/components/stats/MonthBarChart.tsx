import { EvilBarChart } from "#components/evilcharts/charts/recharts-bar-chart";
import { chartColor } from "#lib/chartColor";
import { m } from "#lib/i18n";

const config = { count: { label: m.stats_added(), ...chartColor("var(--chart-2)") } };

/** Items added per month. */
export function MonthBarChart({ data }: { data: { month: string; count: number }[] }) {
  return (
    <EvilBarChart
      config={config}
      data={data}
      barRadius={8}
      className="aspect-auto h-[200px]"
      chartProps={{ maxBarSize: 40, margin: { top: 8 } }}
    >
      <EvilBarChart.Grid />
      <EvilBarChart.XAxis dataKey="month" tickMargin={10} />
      <EvilBarChart.Tooltip />
      <EvilBarChart.Bar dataKey="count" variant="gradient" />
    </EvilBarChart>
  );
}
