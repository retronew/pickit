// The scheduled tasks: what each does, on which cron trigger, and a log of
// their runs for the settings page. The expressions must match
// wrangler.jsonc `triggers.crons`; Cloudflare runs them in UTC.

import type { CronOverview, CronRun, CronRunStatus, CronTaskId } from "@pickit/shared";
import type { Env } from "#types";
import { advanceRunningJobs } from "#job-runners";
import { backfillCompactVectors } from "#vectors";
import { runDeadLinkCheck } from "#cron";
import { backfillPreviews } from "#previews";
import { writeBackup, pruneBackups } from "#backups";
import { pruneAudit, safeAudit } from "#audit/index";
import { backfillContent } from "#item-content";
import { backfillActivity } from "#activity";
import { nextRun } from "#cron-schedule";

export const EVERY_MINUTE = "* * * * *";
export const DAILY = "0 18 * * *";

const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT = 10;
const SYSTEM = "system";

interface TaskResult {
  processed: number;
  detail?: Record<string, number | string>;
  /** Nothing to do or not configured. */
  skipped?: boolean;
}

interface CronTask {
  id: CronTaskId;
  cron: string;
  run: (env: Env) => Promise<TaskResult>;
}

async function dailyBackup(env: Env): Promise<TaskResult> {
  if (!env.BACKUPS) return { processed: 0, skipped: true };
  try {
    const backup = await writeBackup(env, "daily");
    const removed = await pruneBackups(env);
    await safeAudit(env.DB, {
      actor: SYSTEM,
      action: "system.backup",
      summary: { key: "audit_sum_daily_backup", params: { count: backup.count ?? 0, name: backup.name, removed } },
    });
    return { processed: 1, detail: { items: backup.count ?? 0, removed } };
  } catch (err) {
    await safeAudit(env.DB, {
      actor: SYSTEM,
      action: "system.backup",
      summary: { key: "audit_sum_daily_backup_failed" },
      status: 500,
      detail: { error: String(err) },
    });
    throw err;
  }
}

async function linkCheck(env: Env): Promise<TaskResult> {
  const r = await runDeadLinkCheck(env);
  if (r.checked > 0) {
    await safeAudit(env.DB, {
      actor: SYSTEM,
      action: "system.link_check",
      summary: { key: "audit_sum_link_check", params: { checked: r.checked, broken: r.broken } },
    });
  }
  return { processed: r.checked, detail: { broken: r.broken } };
}

async function compactVectors(env: Env): Promise<TaskResult> {
  let processed = 0;
  for (let i = 0; i < 5; i++) {
    const n = await backfillCompactVectors(env.DB);
    processed += n;
    if (n === 0) break;
  }
  return { processed };
}

const count = (n: number): TaskResult => ({ processed: n });

export const TASKS: CronTask[] = [
  // Keeps re-embedding / organizing / summary / activity jobs moving when no page drives them.
  { id: "jobs", cron: EVERY_MINUTE, run: async (env) => count(await advanceRunningJobs(env)) },
  // Fills compact vectors for embeddings stored before they existed.
  { id: "vectors", cron: EVERY_MINUTE, run: compactVectors },
  // Preview images for older items, a few at a time.
  { id: "previews", cron: EVERY_MINUTE, run: async (env) => count(await backfillPreviews(env.DB)) },
  // Page text for older items (needs R2).
  {
    id: "content",
    cron: EVERY_MINUTE,
    run: async (env) => (env.BACKUPS ? count(await backfillContent(env)) : { processed: 0, skipped: true }),
  },
  // GitHub / npm activity: new projects first, then weekly.
  { id: "activity", cron: EVERY_MINUTE, run: async (env) => count(await backfillActivity(env)) },
  { id: "backup", cron: DAILY, run: dailyBackup },
  { id: "link_check", cron: DAILY, run: linkCheck },
  { id: "audit_prune", cron: DAILY, run: async (env) => count(await pruneAudit(env.DB)) },
];

export const findTask = (id: string) => TASKS.find((t) => t.id === id);

/**
 * Runs one task and logs it. Per-minute tasks that did nothing aren't
 * logged (they'd flood the table); daily and manual runs always are.
 */
export async function runTask(env: Env, task: CronTask, trigger: "cron" | "manual"): Promise<CronRun | null> {
  const startedAt = Date.now();
  let status: CronRunStatus = "ok";
  let result: TaskResult = { processed: 0 };
  let error: string | null = null;
  try {
    result = await task.run(env);
    if (result.skipped) status = "skipped";
  } catch (e) {
    status = "error";
    error = String(e instanceof Error ? e.message : e).slice(0, 500);
  }
  const quiet = task.cron === EVERY_MINUTE && trigger === "cron" && status !== "error" && result.processed === 0;
  if (quiet) return null;
  const finishedAt = Date.now();
  const detail = result.detail ? JSON.stringify(result.detail) : null;
  const { meta } = await env.DB.prepare(
    `INSERT INTO cron_runs (task, trigger, started_at, finished_at, status, processed, detail, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(task.id, trigger, startedAt, finishedAt, status, result.processed, detail, error)
    .run();
  return {
    id: Number(meta.last_row_id),
    task: task.id,
    trigger,
    startedAt,
    finishedAt,
    status,
    processed: result.processed,
    detail: result.detail ?? null,
    error,
  };
}

/** Everything a cron trigger does: note the tick, run its tasks, prune old logs. */
export async function runSchedule(env: Env, cron: string) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  )
    .bind(`cron_tick:${cron}`, String(Date.now()))
    .run();
  const tasks = TASKS.filter((t) => t.cron === cron);
  await Promise.all(tasks.map((t) => runTask(env, t, "cron")));
  if (cron === DAILY) {
    await env.DB.prepare("DELETE FROM cron_runs WHERE started_at < ?").bind(Date.now() - KEEP_MS).run();
  }
}

interface RunRow {
  id: number;
  task: CronTaskId;
  trigger: "cron" | "manual";
  started_at: number;
  finished_at: number;
  status: CronRunStatus;
  processed: number;
  detail: string | null;
  error: string | null;
}

const toRun = (r: RunRow): CronRun => ({
  id: r.id,
  task: r.task,
  trigger: r.trigger,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  status: r.status,
  processed: r.processed,
  detail: r.detail ? JSON.parse(r.detail) : null,
  error: r.error,
});

/** Every task with its schedule, next run, latest runs, and when each trigger last fired. */
export async function cronOverview(db: D1Database, now = Date.now()): Promise<CronOverview> {
  const { results } = await db
    .prepare(
      `SELECT * FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY task ORDER BY started_at DESC) AS n FROM cron_runs
       ) WHERE n <= ? ORDER BY started_at DESC`,
    )
    .bind(RECENT)
    .all<RunRow>();
  const runs = results.map(toRun);
  const crons = [...new Set(TASKS.map((t) => t.cron))];
  const ticks = await Promise.all(
    crons.map((c) =>
      db.prepare("SELECT value FROM settings WHERE key = ?").bind(`cron_tick:${c}`).first<{ value: string }>(),
    ),
  );
  return {
    tasks: TASKS.map((t) => {
      const recent = runs.filter((r) => r.task === t.id);
      return { id: t.id, cron: t.cron, nextAt: nextRun(t.cron, now), lastRun: recent[0] ?? null, recent };
    }),
    lastTicks: Object.fromEntries(crons.map((c, i) => [c, ticks[i] ? Number(ticks[i]!.value) : null])),
  };
}
