-- Audit trail of every action (API writes, sign-in / sign-out, cron jobs).
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  status INTEGER,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log (actor, created_at DESC);
