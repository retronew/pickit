-- Share management: visit counters on each share and a log of recent visits.
-- view_count / last_viewed_at: lifetime totals (the log below is pruned).
-- share_visits: one row per page view or RSS fetch, kept for 180 days.
--   referrer: the referring site's host ('' when direct); country: from Cloudflare.
ALTER TABLE shares ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shares ADD COLUMN last_viewed_at INTEGER;

CREATE TABLE IF NOT EXISTS share_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  at INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'page',
  referrer TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_share_visits_slug_at ON share_visits (slug, at);
CREATE INDEX IF NOT EXISTS idx_share_visits_at ON share_visits (at);
