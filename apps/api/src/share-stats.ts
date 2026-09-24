// Visit stats of a share: totals, a daily chart, top referrers and
// countries, and the latest visits, from the log kept by share-visits.

import type { ShareStats, VisitKind } from "@pickit/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

export async function shareStats(db: D1Database, slug: string, days = 30, now = Date.now()): Promise<ShareStats | null> {
  const share = await db
    .prepare("SELECT view_count, last_viewed_at FROM shares WHERE slug = ?")
    .bind(slug)
    .first<{ view_count: number; last_viewed_at: number | null }>();
  if (!share) return null;
  const since = Date.parse(dayKey(now - (days - 1) * DAY_MS));

  const [daily, referrers, countries, recent, visitors] = await Promise.all([
    db
      .prepare(
        `SELECT strftime('%Y-%m-%d', at / 1000, 'unixepoch') AS day, kind, COUNT(*) AS count
         FROM share_visits WHERE slug = ? AND at >= ? GROUP BY day, kind`,
      )
      .bind(slug, since)
      .all<{ day: string; kind: VisitKind; count: number }>(),
    db
      .prepare(
        `SELECT referrer AS host, COUNT(*) AS count FROM share_visits
         WHERE slug = ? AND at >= ? AND referrer != '' GROUP BY referrer ORDER BY count DESC LIMIT 10`,
      )
      .bind(slug, since)
      .all<{ host: string; count: number }>(),
    db
      .prepare(
        `SELECT country, COUNT(*) AS count FROM share_visits
         WHERE slug = ? AND at >= ? AND country != '' GROUP BY country ORDER BY count DESC LIMIT 10`,
      )
      .bind(slug, since)
      .all<{ country: string; count: number }>(),
    db
      .prepare(
        `SELECT at, kind, referrer, country, browser, os, device FROM share_visits
         WHERE slug = ? ORDER BY at DESC LIMIT 20`,
      )
      .bind(slug)
      .all<ShareStats["recent"][number]>(),
    db
      .prepare("SELECT COUNT(DISTINCT visitor) AS count FROM share_visits WHERE slug = ? AND at >= ? AND visitor != ''")
      .bind(slug, since)
      .first<{ count: number }>(),
  ]);

  const byDay = Array.from({ length: days }, (_, i) => ({ day: dayKey(since + i * DAY_MS), page: 0, rss: 0 }));
  const index = new Map(byDay.map((d) => [d.day, d]));
  for (const r of daily.results) {
    const d = index.get(r.day);
    if (d) d[r.kind === "rss" ? "rss" : "page"] += r.count;
  }
  return {
    total: share.view_count,
    lastViewedAt: share.last_viewed_at,
    last30: byDay.reduce((sum, d) => sum + d.page + d.rss, 0),
    visitors30: visitors?.count ?? 0,
    byDay,
    referrers: referrers.results,
    countries: countries.results,
    recent: recent.results,
  };
}
