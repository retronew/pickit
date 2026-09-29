import { EvilBarChart } from "#components/evilcharts/charts/recharts-bar-chart";
import { chartColor } from "#lib/chartColor";

const ROW_HEIGHT = 28;

/** A top-N ranking as horizontal bars, one row per entry. */
export function RankBarChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const config = { value: { label, ...chartColor("var(--chart-2)") } };
  return (
    <div style={{ height: data.length * ROW_HEIGHT + 8 }}>
      <EvilBarChart
        config={config}
        data={data}
        layout="horizontal"
        barRadius={5}
        className="aspect-auto h-full"
        chartProps={{ barSize: 12, margin: { left: -8 } }}
      >
        <EvilBarChart.XAxis dataKey="value" hide />
        <EvilBarChart.YAxis dataKey="label" width={108} tickMargin={10} />
        <EvilBarChart.Tooltip />
        <EvilBarChart.Bar dataKey="value" />
      </EvilBarChart>
    </div>
  );
}
