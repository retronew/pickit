-- Share access limits.
-- expires_at: when the link stops working (ms since epoch); NULL = never.
-- password_hash: "pbkdf2$<iterations>$<salt hex>$<hash hex>"; NULL = no password.
ALTER TABLE shares ADD COLUMN expires_at INTEGER;
ALTER TABLE shares ADD COLUMN password_hash TEXT;
