import { ShareDonutChart } from "#components/stats/ShareDonutChart";
import { m } from "#lib/i18n";

/** Share of items per category: the top few, then everything else as "Other". */
export function CategoryDonutChart({ data }: { data: { category: string; count: number }[] }) {
  return <ShareDonutChart data={data.map((c) => ({ label: c.category || m.uncategorized(), count: c.count }))} />;
}
