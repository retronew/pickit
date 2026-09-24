// Audit action names (written by the API) and their display labels (from
// the message catalogs, key audit_action_<action with "." → "_">). The API's
// labels.test.ts checks every emitted action is listed here, and the i18n
// test checks every listed action has a translation.

import { m, type Locale } from "./i18n";

export const AUDIT_CATEGORIES = ["item", "category", "tag", "share", "settings", "job", "ai", "auth", "backup", "mcp", "system", "other"] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_ACTIONS = [
  "item.create",
  "item.update",
  "item.pin",
  "item.unpin",
  "item.delete",
  "item.restore",
  "item.purge",
  "item.summarize",
  "item.translate",
  "item.check",
  "item.reembed",
  "item.visit",
  "item.analyze",
  "item.import",
  "item.import_preview",
  "item.export",
  "item.merge",
  "item.bulk_delete",
  "item.bulk_pin",
  "item.bulk_unpin",
  "item.bulk_category",
  "item.bulk_purge",
  "item.bulk_restore",
  "item.bulk_add_tags",
  "item.bulk_remove_tags",
  "item.bulk_apply",
  "item.suggest",
  "item.reorder",
  "category.rename",
  "category.delete",
  "tag.rename",
  "tag.delete",
  "share.create",
  "share.revoke",
  "share.update",
  "settings.ai_update",
  "settings.ai_models",
  "settings.ai_test",
  "settings.token_reset",
  "settings.token_delete",
  "settings.allowed_emails",
  "settings.audit_retention",
  "settings.locale",
  "settings.saved_searches",
  "settings.webhook_create",
  "settings.webhook_update",
  "settings.webhook_delete",
  "settings.webhook_test",
  "job.start",
  "job.pause",
  "job.resume",
  "job.retry",
  "ai.chat",
  "mcp.call",
  "auth.sign_in",
  "auth.sign_in_denied",
  "auth.sign_out",
  "backup.create",
  "backup.restore",
  "backup.restore_preview",
  "backup.download",
  "backup.delete",
  "system.backup",
  "system.link_check",
  "other",
] as const;

type Message = (inputs?: Record<string, never>, options?: { locale?: Locale }) => string;
const messages = m as unknown as Record<string, Message | undefined>;

export function auditActionCategory(action: string): string {
  return action.includes(".") ? action.split(".")[0] : "other";
}

export function auditCategoryLabel(category: string, locale?: Locale): string {
  return messages[`audit_category_${category}`]?.({}, { locale }) ?? category;
}

/** Label for an action; unknown ones fall back to "<category> · <action>". */
export function auditActionLabel(action: string, locale?: Locale): string {
  const label = messages[`audit_action_${action.replace(/\./g, "_")}`];
  if (label) return label({}, { locale });
  return `${auditCategoryLabel(auditActionCategory(action), locale)} · ${action}`;
}
