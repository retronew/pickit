import type { Env } from "#types";
import { advanceRunningJobs } from "#job-runners";
import { backfillCompactVectors } from "#vectors";
import { runDeadLinkCheck } from "#cron";
import { writeBackup, pruneBackups } from "#backups";
import { safeAudit, pruneAudit } from "#audit/index";

/** Must match the per-minute entry in wrangler.jsonc `triggers.crons`. */
const JOB_CRON = "* * * * *";
const SYSTEM = "系统";

async function backupWithAudit(env: Env) {
  try {
    if (!env.BACKUPS) return;
    const backup = await writeBackup(env, "daily");
    const removed = await pruneBackups(env);
    await safeAudit(env.DB, {
      actor: SYSTEM,
      action: "system.backup",
      summary: `每日备份：${backup.count} 条收藏写入 ${backup.name}，清理旧备份 ${removed} 个`,
    });
  } catch (err) {
    await safeAudit(env.DB, {
      actor: SYSTEM,
      action: "system.backup",
      summary: "每日备份失败",
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
    summary: `检查 ${r.checked} 条链接，${r.broken} 条无法访问`,
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
    return;
  }
  ctx.waitUntil(backupWithAudit(env));
  ctx.waitUntil(linkCheckWithAudit(env));
  ctx.waitUntil(pruneAudit(env.DB));
}
