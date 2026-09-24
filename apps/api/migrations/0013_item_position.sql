-- Manual order of bookmarks within their category (the "manual" sort).
-- NULL = never reordered: such items come first, newest first, so new
-- bookmarks show up at the top of their group.
ALTER TABLE items ADD COLUMN position REAL;
