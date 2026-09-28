-- Partial indexes for the per-minute backfill queries (cron-tasks.ts). Without
-- them each query scans the whole items table every minute even when there is
-- nothing left to do; with them an empty backlog costs next to no row reads.
CREATE INDEX IF NOT EXISTS idx_items_vec_backfill ON items (id)
  WHERE embedding IS NOT NULL AND vec IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_preview_backfill ON items (id)
  WHERE deleted_at IS NULL AND url != '' AND image = '' AND preview_checked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_content_backfill ON items (id)
  WHERE deleted_at IS NULL AND url != '' AND content_status = '';
CREATE INDEX IF NOT EXISTS idx_items_content_upgrade ON items (id)
  WHERE deleted_at IS NULL AND url != '' AND content_status IN ('ok', 'empty') AND content_format != 'markdown' AND content_rendered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_content_due_live ON items (content_due_at)
  WHERE deleted_at IS NULL AND url != '' AND content_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_activity_backfill ON items (activity_at)
  WHERE deleted_at IS NULL AND (url LIKE '%github.com/%' OR url LIKE '%npmjs.com/package/%');
