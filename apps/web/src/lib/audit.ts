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
  AUDIT_ACTION_LABELS,
  auditActionLabel as actionLabel,
  auditActionCategory as actionCategory,
} from "@pickit/shared";

export function isFailure(e: Pick<AuditEntry, "status">): boolean {
  return e.status != null && e.status >= 400;
}
