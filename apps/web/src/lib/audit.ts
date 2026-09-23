import { isMessageRef, renderMessage } from "@pickit/shared/i18n";
import { m } from "#lib/i18n";

export interface AuditEntry {
  id: number;
  createdAt: number;
  actor: string;
  action: string;
  target: string;
  summary: string;
  status: number | null;
  ip: string;
  userAgent: string;
  detail: Record<string, unknown>;
}

export {
  AUDIT_CATEGORIES,
  auditCategoryLabel as categoryLabel,
  auditActionLabel as actionLabel,
  auditActionCategory as actionCategory,
} from "@pickit/shared";

export function isFailure(e: Pick<AuditEntry, "status">): boolean {
  return e.status != null && e.status >= 400;
}

/** The summary in the current language when it was stored as a message ref. */
export function auditSummary(entry: AuditEntry): string {
  const ref = entry.detail?.message;
  return isMessageRef(ref) ? renderMessage(ref) : entry.summary;
}

/** Built-in actors are stored as codes (older rows in Chinese). */
export function actorLabel(actor: string): string {
  if (actor === "anonymous" || actor === "匿名") return m.audit_actor_anonymous();
  if (actor === "system" || actor === "系统") return m.audit_actor_system();
  return actor;
}
