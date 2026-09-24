// Visit tracking for public share links: lifetime counters on the share
// plus a pruned per-visit log for the stats on the shares page.

export type VisitKind = "page" | "rss";

const KEEP_MS = 180 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless/i;

export interface VisitInfo {
  kind: VisitKind;
  referrer: string;
  country: string;
}

/** What to log about a request; null for crawlers and link-preview bots. */
export function visitInfo(req: Request, kind: VisitKind, ownHost: string): VisitInfo | null {
  const ua = req.headers.get("user-agent") ?? "";
  // Feed readers identify as bots too; count those fetches as RSS anyway.
  if (kind === "page" && BOT_UA.test(ua)) return null;
  let referrer = "";
  try {
    const host = new URL(req.headers.get("referer") ?? "").host;
    if (host !== ownHost) referrer = host;
  } catch {
    // No or invalid referrer: a direct visit.
  }
  const cf = (req as Request & { cf?: { country?: string } }).cf;
  return { kind, referrer, country: cf?.country ?? "" };
}

export async function recordVisit(db: D1Database, slug: string, visit: VisitInfo, now = Date.now()) {
  await db.batch([
    db
      .prepare("UPDATE shares SET view_count = view_count + 1, last_viewed_at = ? WHERE slug = ?")
      .bind(now, slug),
    db
      .prepare("INSERT INTO share_visits (slug, at, kind, referrer, country) VALUES (?, ?, ?, ?, ?)")
      .bind(slug, now, visit.kind, visit.referrer, visit.country),
    db.prepare("DELETE FROM share_visits WHERE at < ?").bind(now - KEEP_MS),
  ]);
}

export interface ShareStats {
  total: number;
  lastViewedAt: number | null;
  last30: number;
  /** Oldest first, one entry per day (UTC) for the last `days` days. */
  byDay: { day: string; page: number; rss: number }[];
  referrers: { host: string; count: number }[];
  countries: { country: string; count: number }[];
  recent: { at: number; kind: VisitKind; referrer: string; country: string }[];
}

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

export async function shareStats(db: D1Database, slug: string, days = 30, now = Date.now()): Promise<ShareStats | null> {
  const share = await db
    .prepare("SELECT view_count, last_viewed_at FROM shares WHERE slug = ?")
    .bind(slug)
    .first<{ view_count: number; last_viewed_at: number | null }>();
  if (!share) return null;
  const since = Date.parse(dayKey(now - (days - 1) * DAY_MS));

  const [daily, referrers, countries, recent] = await Promise.all([
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
      .prepare("SELECT at, kind, referrer, country FROM share_visits WHERE slug = ? ORDER BY at DESC LIMIT 20")
      .bind(slug)
      .all<ShareStats["recent"][number]>(),
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
    byDay,
    referrers: referrers.results,
    countries: countries.results,
    recent: recent.results,
  };
}
