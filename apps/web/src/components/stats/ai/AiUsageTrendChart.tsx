import type { AiUsageDay } from "@pickit/shared";
import { EvilBarChart } from "#components/evilcharts/charts/recharts-bar-chart";
import { chartColor } from "#lib/chartColor";
import { formatDay, formatTokens } from "#lib/ai-usage";
import { m } from "#lib/i18n";

const config = {
  inputTokens: { label: m.ai_usage_input_tokens(), ...chartColor("var(--chart-2)") },
  outputTokens: { label: m.ai_usage_output_tokens(), ...chartColor("var(--chart-4)") },
};

/** Input and output tokens per local day, stacked. */
export function AiUsageTrendChart({ data }: { data: AiUsageDay[] }) {
  const rows = data.map((d) => ({ ...d, label: formatDay(d.day) }));
  return (
    <EvilBarChart
      config={config}
      data={rows}
      stackType="stacked"
      barRadius={3}
      className="aspect-auto h-[220px]"
      chartProps={{ margin: { top: 8, left: 0, right: 8 } }}
    >
      <EvilBarChart.Grid />
      <EvilBarChart.XAxis dataKey="label" tickMargin={10} minTickGap={16} />
      <EvilBarChart.YAxis width={44} tickFormatter={(v: number) => formatTokens(v)} />
      <EvilBarChart.Tooltip />
      <EvilBarChart.Legend />
      <EvilBarChart.Bar dataKey="inputTokens" />
      <EvilBarChart.Bar dataKey="outputTokens" />
    </EvilBarChart>
  );
}
