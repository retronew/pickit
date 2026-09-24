-- Project activity of GitHub / npm bookmarks (last push or publish, stars,
-- latest version…), refreshed about weekly by the cron.
-- activity: JSON ProjectActivity (see packages/shared/src/activity.ts); '' = none.
-- activity_at: when it was last checked; NULL = never.
ALTER TABLE items ADD COLUMN activity TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN activity_at INTEGER;
