-- Outgoing webhooks: PickIt POSTs a signed JSON event to each enabled URL
-- subscribed to it.
-- events: JSON array of event names, e.g. ["item.created","job.finished"].
-- secret: HMAC-SHA256 key for the X-PickIt-Signature header (shown once).
-- last_*: outcome of the latest delivery, for the settings page.
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '[]',
  secret TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_at INTEGER,
  last_status INTEGER,
  last_error TEXT
);
