-- Token usage of every AI call (chat and embedding), one row per model call.
-- created_at is an absolute instant (epoch ms); days are worked out per
-- request in the viewer's time zone.
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  feature TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL DEFAULT 1,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at);
