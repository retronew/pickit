-- Scheduled task runs, for the settings page. Daily tasks log every run;
-- per-minute tasks only runs that did something or failed (otherwise it'd be
-- ~7,000 rows a day). Kept 30 days. When each schedule last fired is stored
-- in settings (cron_tick:<expression>).
CREATE TABLE IF NOT EXISTS cron_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'cron',
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  detail TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_task ON cron_runs (task, started_at);
CREATE INDEX IF NOT EXISTS idx_cron_runs_started ON cron_runs (started_at);
