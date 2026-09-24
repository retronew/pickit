-- Page text snapshots. The text itself lives in R2 (content/<id>.txt) so D1
-- stays small; the item only records how the latest capture went.
-- content_status: '' = never tried, 'ok', 'empty' (no readable text), 'failed'.
-- content_at: when it was captured (or tried); content_size: bytes of text.
ALTER TABLE items ADD COLUMN content_status TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN content_at INTEGER;
ALTER TABLE items ADD COLUMN content_size INTEGER;
