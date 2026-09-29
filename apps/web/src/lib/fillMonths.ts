const MIN_MONTHS = 12;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Fills in months with no items as 0, from the first month (or 12 months back,
 * whichever is earlier) through the current month, so a trend line always has
 * enough points to draw.
 */
export function fillMonths(
  rows: { month: string; count: number }[],
  now = new Date(),
): { month: string; count: number }[] {
  const counts = new Map(rows.map((r) => [r.month, r.count]));
  const cursor = new Date(now.getFullYear(), now.getMonth() - (MIN_MONTHS - 1), 1);
  const first = rows[0]?.month;
  if (first) {
    const [y, m] = first.split("-").map(Number);
    const firstDate = new Date(y, m - 1, 1);
    if (firstDate < cursor) cursor.setTime(firstDate.getTime());
  }
  const end = monthKey(now);
  const out: { month: string; count: number }[] = [];
  for (;;) {
    const key = monthKey(cursor);
    out.push({ month: key, count: counts.get(key) ?? 0 });
    if (key >= end) return out;
    cursor.setMonth(cursor.getMonth() + 1);
  }
}
