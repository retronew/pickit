-- Share visits: who and what, so repeat views can be skipped and the stats say more.
-- visitor: a hash of IP + user agent + share (no raw IP is stored); a visitor's
--   repeat view of the same share within 30 minutes is not counted again.
-- browser / os / device: parsed from the user agent ('' when unknown).
ALTER TABLE share_visits ADD COLUMN visitor TEXT NOT NULL DEFAULT '';
ALTER TABLE share_visits ADD COLUMN browser TEXT NOT NULL DEFAULT '';
ALTER TABLE share_visits ADD COLUMN os TEXT NOT NULL DEFAULT '';
ALTER TABLE share_visits ADD COLUMN device TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_share_visits_visitor ON share_visits (slug, visitor, at);
