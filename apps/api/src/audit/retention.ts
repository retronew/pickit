// How long audit entries are kept (settings key `audit_retention_days`,
// 0 = forever) and how much space they take.

export const DEFAULT_RETENTION_DAYS = 180;
export const MAX_RETENTION_DAYS = 3650;
const KEY = "audit_retention_days";
const DAY_MS = 86_400_000;

export async function getRetentionDays(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind(KEY)
    .first<{ value: string }>();
  const days = row ? Number(row.value) : DEFAULT_RETENTION_DAYS;
  return Number.isInteger(days) && days >= 0 ? days : DEFAULT_RETENTION_DAYS;
}

export function isValidRetention(days: unknown): days is number {
  return Number.isInteger(days) && (days as number) >= 0 && (days as number) <= MAX_RETENTION_DAYS;
}

export async function setRetentionDays(db: D1Database, days: number) {
  await db
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .bind(KEY, String(days))
    .run();
}

/** Deletes entries older than the retention window; returns how many. */
export async function pruneAudit(db: D1Database, days?: number): Promise<number> {
  const keep = days ?? (await getRetentionDays(db));
  if (keep === 0) return 0;
  const res = await db
    .prepare("DELETE FROM audit_log WHERE created_at < ?")
    .bind(Date.now() - keep * DAY_MS)
    .run();
  return res.meta.changes ?? 0;
}

// D1 has no dbstat, so the table size is estimated from the stored bytes of
// every column plus per-row overhead for the record header, the integer
// columns and the three indexes (created_at, action, actor).
const ROW_OVERHEAD = 48;

export interface AuditStats {
  count: number;
  /** Estimated bytes used by audit_log and its indexes. */
  bytes: number;
  oldest: number | null;
  newest: number | null;
  /** Size of the whole D1 database, as reported by D1. */
  databaseBytes: number | null;
}

export async function auditStats(db: D1Database): Promise<AuditStats> {
  const res = await db
    .prepare(
      `SELECT COUNT(*) AS count, MIN(created_at) AS oldest, MAX(created_at) AS newest,
        COALESCE(SUM(
          length(CAST(actor AS BLOB)) * 2 + length(CAST(action AS BLOB)) * 2
          + length(CAST(target AS BLOB)) + length(CAST(summary AS BLOB))
          + length(CAST(ip AS BLOB)) + length(CAST(user_agent AS BLOB))
          + length(CAST(detail AS BLOB))
        ), 0) AS textBytes
       FROM audit_log`,
    )
    .all<{ count: number; oldest: number | null; newest: number | null; textBytes: number }>();
  const row = res.results[0];
  const meta = res.meta as { size_after?: number };
  return {
    count: row.count,
    bytes: row.textBytes + row.count * ROW_OVERHEAD,
    oldest: row.oldest,
    newest: row.newest,
    databaseBytes: meta.size_after ?? null,
  };
}
