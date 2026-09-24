import type { CronRun, CronTaskId } from "@pickit/shared";
import { intlLocale, m } from "#lib/i18n";

export const CRON_TASK_LABELS: Record<CronTaskId, { name: () => string; hint: () => string }> = {
  jobs: { name: m.cron_task_jobs, hint: m.cron_task_jobs_hint },
  vectors: { name: m.cron_task_vectors, hint: m.cron_task_vectors_hint },
  previews: { name: m.cron_task_previews, hint: m.cron_task_previews_hint },
  content: { name: m.cron_task_content, hint: m.cron_task_content_hint },
  activity: { name: m.cron_task_activity, hint: m.cron_task_activity_hint },
  backup: { name: m.cron_task_backup, hint: m.cron_task_backup_hint },
  link_check: { name: m.cron_task_link_check, hint: m.cron_task_link_check_hint },
  audit_prune: { name: m.cron_task_audit_prune, hint: m.cron_task_audit_prune_hint },
};

/** The viewer's time zone, e.g. "Asia/Shanghai (GMT+8)". */
export function timeZoneLabel(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset =
    new Intl.DateTimeFormat("en-US", { timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  return offset ? `${zone} (${offset})` : zone;
}

/** "Every minute" / "Daily at 02:00" in the viewer's time zone (from the next run). */
export function scheduleLabel(cron: string, nextAt: number | null): string {
  if (cron === "* * * * *") return m.cron_group_minute();
  const time = nextAt
    ? new Intl.DateTimeFormat(intlLocale(), { hour: "2-digit", minute: "2-digit" }).format(nextAt)
    : cron;
  return m.cron_group_daily({ time });
}

/** "12 processed · 2 dead" for a run. */
export function runSummary(run: CronRun): string {
  const parts = [m.cron_processed({ count: run.processed })];
  const d = run.detail ?? {};
  if (typeof d.broken === "number" && d.broken > 0) parts.push(m.cron_detail_broken({ count: d.broken }));
  if (typeof d.items === "number") parts.push(m.cron_detail_items({ count: d.items }));
  if (typeof d.removed === "number" && d.removed > 0) parts.push(m.cron_detail_removed({ count: d.removed }));
  return parts.join(" · ");
}
