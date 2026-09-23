// Audit trail storage: every API write (plus exports), sign-in / sign-out and
// cron runs end up as one row in audit_log.

export const AUDIT_RETENTION_DAYS = 180;

export interface AuditEntry {
  actor: string;
  action: string;
  target?: string;
  summary?: string;
  status?: number | null;
  ip?: string;
  userAgent?: string;
  detail?: Record<string, unknown>;
}

export async function writeAudit(db: D1Database, e: AuditEntry) {
  await db
    .prepare(
      `INSERT INTO audit_log (created_at, actor, action, target, summary, status, ip, user_agent, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      Date.now(),
      e.actor,
      e.action,
      e.target ?? "",
      e.summary ?? "",
      e.status ?? null,
      e.ip ?? "",
      (e.userAgent ?? "").slice(0, 300),
      JSON.stringify(e.detail ?? {}),
    )
    .run();
}

/** Logs without ever failing the caller; audit problems only go to the console. */
export function safeAudit(db: D1Database, e: AuditEntry): Promise<void> {
  return writeAudit(db, e).catch((err) => console.error("audit write failed", err));
}

/** Drops entries older than the retention window (daily cron). */
export function pruneAudit(db: D1Database) {
  return db
    .prepare("DELETE FROM audit_log WHERE created_at < ?")
    .bind(Date.now() - AUDIT_RETENTION_DAYS * 86_400_000)
    .run();
}

export function requestMeta(req: Request) {
  return {
    ip: req.headers.get("cf-connecting-ip") ?? "",
    userAgent: req.headers.get("user-agent") ?? "",
  };
}
