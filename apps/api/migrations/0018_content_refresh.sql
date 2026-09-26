-- Page text snapshots get captured again, not only the first time:
-- content_attempts: failed captures in a row (reset on success); retries stop after 3.
-- content_due_at: when the backfill should capture it again (a retry after a
--   failure, or "recapture all"); NULL = nothing scheduled.
-- content_format: '' = legacy plain text, 'text' or 'markdown' (Browser Rendering).
-- content_rendered_at: when Browser Rendering last tried this item, so old
--   plain-text snapshots are upgraded to Markdown once, not over and over.
ALTER TABLE items ADD COLUMN content_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN content_due_at INTEGER;
ALTER TABLE items ADD COLUMN content_format TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN content_rendered_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_items_content_due ON items (content_due_at) WHERE content_due_at IS NOT NULL;
