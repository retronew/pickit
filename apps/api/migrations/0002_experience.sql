ALTER TABLE items ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN deleted_at INTEGER;
ALTER TABLE items ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN last_visited_at INTEGER;
ALTER TABLE items ADD COLUMN url_norm TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_items_url_norm ON items(url_norm);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_deleted ON items(deleted_at);

-- SQL approximation of normalizeUrl(): good enough for existing rows,
-- new writes always go through the real normalizeUrl() in packages/shared.
UPDATE items
SET url_norm = lower(rtrim(replace(replace(url, 'https://', ''), 'http://', ''), '/'))
WHERE url != '';
