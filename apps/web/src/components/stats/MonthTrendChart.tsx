import { EvilAreaChart } from "#components/evilcharts/charts/recharts-area-chart";
import { chartColor } from "#lib/chartColor";
import { fillMonths } from "#lib/fillMonths";
import { m } from "#lib/i18n";

const config = { count: { label: m.stats_added(), ...chartColor("var(--chart-2)") } };

/** Items added per month, as a trend line. */
export function MonthTrendChart({ data }: { data: { month: string; count: number }[] }) {
  return (
    <EvilAreaChart
      config={config}
      data={fillMonths(data)}
      curveType="monotone"
      className="aspect-auto h-[200px]"
      chartProps={{ margin: { top: 8, left: 8, right: 8 } }}
    >
      <EvilAreaChart.Grid />
      <EvilAreaChart.XAxis dataKey="month" tickMargin={10} minTickGap={24} />
      <EvilAreaChart.Tooltip />
      <EvilAreaChart.Area dataKey="count">
        <EvilAreaChart.ActiveDot />
      </EvilAreaChart.Area>
    </EvilAreaChart>
  );
}
