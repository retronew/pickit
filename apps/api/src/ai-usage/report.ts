// Aggregates ai_usage for the stats page. SQL sums 15-minute UTC buckets
// (fine enough for any zone offset); they are then folded into local days of
// the viewer's zone here, where Intl knows about DST.

import {
  bucketByDay,
  emptyTotals,
  addTotals,
  recentDays,
  startOfLocalDay,
  type AiUsageFeature,
  type AiUsageModel,
  type AiUsageReport,
  type AiUsageTotals,
} from "@pickit/shared";

const BUCKET_MS = 15 * 60_000;
const SUMS = `COUNT(*) AS calls, SUM(1 - ok) AS failed,
  SUM(input_tokens) AS inputTokens, SUM(output_tokens) AS outputTokens`;

export async function usageReport(
  db: D1Database,
  days: number,
  timeZone: string,
  now = Date.now(),
): Promise<AiUsageReport> {
  const dayList = recentDays(days, timeZone, now);
  const since = startOfLocalDay(dayList[0], timeZone);
  const [buckets, models, features] = await db.batch<Record<string, unknown>>([
    db
      .prepare(`SELECT (created_at / ${BUCKET_MS}) * ${BUCKET_MS} AS at, ${SUMS} FROM ai_usage WHERE created_at >= ? GROUP BY 1`)
      .bind(since),
    db
      .prepare(
        `SELECT kind, provider, model, ${SUMS} FROM ai_usage WHERE created_at >= ?
         GROUP BY kind, provider, model ORDER BY inputTokens + outputTokens DESC, calls DESC`,
      )
      .bind(since),
    db
      .prepare(`SELECT feature, ${SUMS} FROM ai_usage WHERE created_at >= ? GROUP BY feature ORDER BY calls DESC`)
      .bind(since),
  ]);

  const totals = emptyTotals();
  const bucketRows = (buckets.results as unknown as (AiUsageTotals & { at: number })[]).map(numeric);
  bucketRows.forEach((b) => addTotals(totals, b));
  return {
    timeZone,
    totals,
    byDay: bucketByDay(bucketRows, dayList, timeZone),
    byModel: (models.results as unknown as AiUsageModel[]).map(numeric),
    byFeature: (features.results as unknown as AiUsageFeature[]).map(numeric),
  };
}

/** SUM() is NULL on no rows and may come back as a float; normalize. */
function numeric<T extends AiUsageTotals>(r: T): T {
  return {
    ...r,
    calls: Number(r.calls) || 0,
    failed: Number(r.failed) || 0,
    inputTokens: Number(r.inputTokens) || 0,
    outputTokens: Number(r.outputTokens) || 0,
  };
}
