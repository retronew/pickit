import { EvilPieChart } from "#components/evilcharts/charts/recharts-pie-chart";
import { chartColor } from "#lib/chartColor";
import { m } from "#lib/i18n";

const TOP = 5;
const COLORS = ["var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-1)"];
const OTHER_COLOR = "var(--muted-foreground)";

/** Share of items per category: the top few, then everything else as "Other". */
export function CategoryDonutChart({ data }: { data: { category: string; count: number }[] }) {
  const top = data.slice(0, TOP);
  const rest = data.slice(TOP).reduce((sum, c) => sum + c.count, 0);
  // Sector names are synthetic keys: category names aren't safe CSS variable names.
  const rows = top.map((c, i) => ({ key: `c${i}`, label: c.category || m.uncategorized(), count: c.count, color: COLORS[i] }));
  if (rest > 0) rows.push({ key: "other", label: m.stats_category_other(), count: rest, color: OTHER_COLOR });

  const config = Object.fromEntries(rows.map((r) => [r.key, { label: r.label, ...chartColor(r.color) }]));
  return (
    <EvilPieChart
      config={config}
      data={rows}
      dataKey="count"
      nameKey="key"
      className="mx-auto aspect-square max-h-[320px]"
    >
      <EvilPieChart.Pie innerRadius="55%" paddingAngle={2} cornerRadius={4} />
      <EvilPieChart.Tooltip />
      <EvilPieChart.Legend />
    </EvilPieChart>
  );
}
