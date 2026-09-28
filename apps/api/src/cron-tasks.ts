// The scheduled tasks: what each does, on which schedule, and a log of their
// runs for the settings page. EVERY_MINUTE and DAILY must match wrangler.jsonc
// `triggers.crons`; EVERY_FIVE_MINUTES has no trigger of its own (cron
// triggers are limited per account) and runs off the per-minute one.
// Cloudflare runs them in UTC.

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
import { matchesAt, nextRun } from "#cron-schedule";

export const EVERY_MINUTE = "* * * * *";
export const DAILY = "0 18 * * *";
/** The backfills: each one's query runs even when there's nothing to do, so not every minute. */
export const EVERY_FIVE_MINUTES = "*/5 * * * *";

/** Schedules run by each wrangler trigger (when they match the trigger's time). */
const SCHEDULES: Record<string, string[]> = {
  [EVERY_MINUTE]: [EVERY_MINUTE, EVERY_FIVE_MINUTES],
  [DAILY]: [DAILY],
};

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
  { id: "vectors", cron: EVERY_FIVE_MINUTES, run: compactVectors },
  // Preview images for older items, a few at a time.
  { id: "previews", cron: EVERY_FIVE_MINUTES, run: async (env) => count(await backfillPreviews(env.DB)) },
  // Page text for older items (needs R2).
  {
    id: "content",
    cron: EVERY_FIVE_MINUTES,
    run: async (env) => (env.BACKUPS ? count(await backfillContent(env)) : { processed: 0, skipped: true }),
  },
  // GitHub / npm activity: new projects first, then weekly.
  { id: "activity", cron: EVERY_FIVE_MINUTES, run: async (env) => count(await backfillActivity(env)) },
  { id: "backup", cron: DAILY, run: dailyBackup },
  { id: "link_check", cron: DAILY, run: linkCheck },
  { id: "audit_prune", cron: DAILY, run: async (env) => count(await pruneAudit(env.DB)) },
];

export const findTask = (id: string) => TASKS.find((t) => t.id === id);

/** Errors D1 raises when its connection drops for a moment; retrying the query works (Cloudflare's advice). */
export function isTransientD1Error(e: unknown): boolean {
  const message = String(e instanceof Error ? e.message : e);
  return /Network connection lost|storage caused object to be reset|transient issue|D1_ERROR: .*(?:timed? ?out|Internal error)/i.test(message);
}

const RETRY_DELAY_MS = 2_000;

/** Runs a task, once more after a short pause if D1 dropped its connection. */
async function runWithRetry(env: Env, task: CronTask): Promise<TaskResult> {
  try {
    return await task.run(env);
  } catch (e) {
    if (!isTransientD1Error(e)) throw e;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return await task.run(env);
  }
}

/**
 * Runs one task and logs it. Frequent tasks that did nothing aren't
 * logged (they'd flood the table); daily and manual runs always are.
 * A transient D1 error is retried once before the run counts as failed.
 */
export async function runTask(env: Env, task: CronTask, trigger: "cron" | "manual"): Promise<CronRun | null> {
  const startedAt = Date.now();
  let status: CronRunStatus = "ok";
  let result: TaskResult = { processed: 0 };
  let error: string | null = null;
  try {
    result = await runWithRetry(env, task);
    if (result.skipped) status = "skipped";
  } catch (e) {
    status = "error";
    error = String(e instanceof Error ? e.message : e).slice(0, 500);
  }
  const quiet = task.cron !== DAILY && trigger === "cron" && status !== "error" && result.processed === 0;
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

/**
 * Everything a cron trigger does: for each schedule due at `at`, note the
 * tick and run its tasks; prune old logs daily. A schedule passed directly
 * (not a trigger) just runs.
 */
export async function runSchedule(env: Env, trigger: string, at = Date.now()) {
  const due = (SCHEDULES[trigger] ?? [trigger]).filter((c) => c === trigger || matchesAt(c, at));
  const now = String(Date.now());
  await env.DB.batch(
    due.map((c) =>
      env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ).bind(`cron_tick:${c}`, now),
    ),
  );
  const tasks = TASKS.filter((t) => due.includes(t.cron));
  await Promise.all(tasks.map((t) => runTask(env, t, "cron")));
  if (trigger === DAILY) {
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
  const lastTicks: Record<string, number | null> = Object.fromEntries(
    crons.map((c, i) => [c, ticks[i] ? Number(ticks[i]!.value) : null]),
  );
  return {
    tasks: TASKS.map((t) => {
      const recent = runs.filter((r) => r.task === t.id);
      const lastRun = recent[0] ?? null;
      // A tick after the last logged run ended means the task ran again quietly.
      const tick = lastTicks[t.cron];
      const quietAt = t.cron !== DAILY && tick && (!lastRun || tick > lastRun.finishedAt) ? tick : null;
      return { id: t.id, cron: t.cron, nextAt: nextRun(t.cron, now), lastRun, recent, quietAt };
    }),
    lastTicks,
  };
}
