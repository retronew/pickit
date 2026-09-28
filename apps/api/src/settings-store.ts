// Reads of rarely changed settings (AI config, API token, allowed emails,
// language...), cached in the isolate for a short while: nearly every request
// and scheduled task reads some of them. A write updates this isolate's cache
// at once; other isolates see it within TTL_MS. Not for values that must be
// exact across isolates (job state, usage counters): read those directly.

const TTL_MS = 30_000;

interface Entry {
  value: string | null;
  at: number;
}

// Keyed by the binding so separate databases (tests) never share entries.
const caches = new WeakMap<D1Database, Map<string, Entry>>();

function cacheFor(db: D1Database): Map<string, Entry> {
  let cache = caches.get(db);
  if (!cache) caches.set(db, (cache = new Map()));
  return cache;
}

export async function readSetting(db: D1Database, key: string): Promise<string | null> {
  const cache = cacheFor(db);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  const value = row?.value ?? null;
  cache.set(key, { value, at: Date.now() });
  return value;
}

export async function writeSetting(db: D1Database, key: string, value: string) {
  await db
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(key, value)
    .run();
  cacheFor(db).set(key, { value, at: Date.now() });
}

export async function deleteSetting(db: D1Database, key: string) {
  await db.prepare("DELETE FROM settings WHERE key = ?").bind(key).run();
  cacheFor(db).set(key, { value: null, at: Date.now() });
}
