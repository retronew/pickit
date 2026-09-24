import type { Env } from "#types";
import { advanceRunningJobs } from "#job-runners";
import { backfillCompactVectors } from "#vectors";
import { runDeadLinkCheck } from "#cron";
import { backfillPreviews } from "#previews";
import { writeBackup, pruneBackups } from "#backups";
import { safeAudit, pruneAudit } from "#audit/index";
import { backfillContent } from "#item-content";

/** Must match the per-minute entry in wrangler.jsonc `triggers.crons`. */
const JOB_CRON = "* * * * *";
const SYSTEM = "system";

async function backupWithAudit(env: Env) {
  try {
    if (!env.BACKUPS) return;
    const backup = await writeBackup(env, "daily");
    const removed = await pruneBackups(env);
    await safeAudit(env.DB, {
      actor: SYSTEM,
      action: "system.backup",
      summary: {
        key: "audit_sum_daily_backup",
        params: { count: backup.count ?? 0, name: backup.name, removed },
      },
    });
  } catch (err) {
    await safeAudit(env.DB, {
      actor: SYSTEM,
      action: "system.backup",
      summary: { key: "audit_sum_daily_backup_failed" },
      status: 500,
      detail: { error: String(err) },
    });
  }
}

async function linkCheckWithAudit(env: Env) {
  const r = await runDeadLinkCheck(env);
  if (r.checked === 0) return;
  await safeAudit(env.DB, {
    actor: SYSTEM,
    action: "system.link_check",
    summary: { key: "audit_sum_link_check", params: { checked: r.checked, broken: r.broken } },
  });
}

async function backfillVectors(env: Env) {
  for (let i = 0; i < 5 && (await backfillCompactVectors(env.DB)) > 0; i++);
}

export async function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
  if (controller.cron === JOB_CRON) {
    // Keeps re-embedding / organizing jobs moving when no page drives them.
    ctx.waitUntil(advanceRunningJobs(env));
    // Fills compact vectors for embeddings stored before they existed.
    ctx.waitUntil(backfillVectors(env));
    // Fetches preview images for older items, a few at a time.
    ctx.waitUntil(backfillPreviews(env.DB).catch(() => {}));
    // Captures page text for older items, a few at a time (needs R2).
    ctx.waitUntil(backfillContent(env).catch(() => {}));
    return;
  }
  ctx.waitUntil(backupWithAudit(env));
  ctx.waitUntil(linkCheckWithAudit(env));
  ctx.waitUntil(pruneAudit(env.DB));
}
