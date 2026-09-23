-- Compact 512-dim int8 vectors used for similarity scans (see src/vectors.ts).
-- Existing rows are backfilled from `embedding` by the per-minute cron.
ALTER TABLE items ADD COLUMN vec BLOB;
