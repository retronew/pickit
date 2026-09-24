-- Link previews and archive fallbacks.
-- image: the page's og:image / twitter:image, shown as a thumbnail.
-- preview_checked_at: when we last tried to fetch it, so the background
--   backfill for older items doesn't retry the same page every minute.
-- archive_url: a Wayback Machine snapshot, looked up when a link goes dead.
ALTER TABLE items ADD COLUMN image TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN preview_checked_at INTEGER;
ALTER TABLE items ADD COLUMN archive_url TEXT NOT NULL DEFAULT '';
