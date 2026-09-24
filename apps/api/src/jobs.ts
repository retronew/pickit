// Resumable batch jobs (re-embedding, AI organizing, AI summaries).
//
// Workers kill waitUntil() work shortly after the response, so a job must
// never run as one long loop. Instead it is advanced in small steps: the
// settings page calls /step back to back while it is open, and a per-minute
// cron keeps stepping when nobody is watching. Each step claims a short lock
// so two drivers never process the same batch.

export type JobKind = "reembed" | "organize" | "summarize";
export type JobStatus = "idle" | "running" | "paused" | "done";

export interface JobFailure {
  id: number;
  name: string;
  error: string;
}

export interface JobState {
  kind: JobKind;
  status: JobStatus;
  mode: string;
  total: number;
  done: number;
  pendingIds: number[];
  failures: JobFailure[];
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
  lastError?: string;
  lockedUntil?: number;
}

export interface StepResult {
  /** Items processed successfully (or skipped because they no longer exist). */
  doneIds: number[];
  failures: JobFailure[];
}

const LOCK_MS = 60_000;
const MAX_FAILURES_KEPT = 200;

function jobKey(kind: JobKind) {
  return `job:${kind}`;
}

export function emptyJob(kind: JobKind): JobState {
  return {
    kind,
    status: "idle",
    mode: "",
    total: 0,
    done: 0,
    pendingIds: [],
    failures: [],
    startedAt: 0,
    updatedAt: 0,
  };
}

async function readRaw(db: D1Database, kind: JobKind): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind(jobKey(kind))
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function getJob(db: D1Database, kind: JobKind): Promise<JobState> {
  const raw = await readRaw(db, kind);
  if (!raw) return emptyJob(kind);
  try {
    return { ...emptyJob(kind), ...(JSON.parse(raw) as JobState) };
  } catch {
    return emptyJob(kind);
  }
}

export async function saveJob(db: D1Database, job: JobState) {
  job.updatedAt = Date.now();
  await db
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .bind(jobKey(job.kind), JSON.stringify(job))
    .run();
}

export async function startJob(
  db: D1Database,
  kind: JobKind,
  mode: string,
  ids: number[],
): Promise<JobState> {
  const now = Date.now();
  const job: JobState = {
    ...emptyJob(kind),
    status: ids.length ? "running" : "done",
    mode,
    total: ids.length,
    pendingIds: ids,
    startedAt: now,
    finishedAt: ids.length ? undefined : now,
  };
  await saveJob(db, job);
  return job;
}

/**
 * Takes the step lock when the job is running and not locked by another
 * driver. Uses compare-and-swap on the stored JSON so concurrent drivers
 * can't both win.
 */
async function claim(db: D1Database, kind: JobKind): Promise<JobState | null> {
  const raw = await readRaw(db, kind);
  if (!raw) return null;
  const job = { ...emptyJob(kind), ...(JSON.parse(raw) as JobState) };
  const now = Date.now();
  if (job.status !== "running" || (job.lockedUntil ?? 0) > now) return null;
  job.lockedUntil = now + LOCK_MS;
  job.updatedAt = now;
  const { meta } = await db
    .prepare("UPDATE settings SET value = ? WHERE key = ? AND value = ?")
    .bind(JSON.stringify(job), jobKey(kind), raw)
    .run();
  return meta.changes === 1 ? job : null;
}

/**
 * Runs one step: claims the lock, hands the next batch of ids to `process`,
 * then merges the outcome into the latest stored state so a pause issued
 * during the step is preserved.
 */
export async function stepJob(
  db: D1Database,
  kind: JobKind,
  batchSize: number,
  process: (ids: number[]) => Promise<StepResult>,
): Promise<JobState> {
  const claimed = await claim(db, kind);
  if (!claimed) return getJob(db, kind);

  const batch = claimed.pendingIds.slice(0, batchSize);
  let result: StepResult;
  let stepError: string | undefined;
  try {
    result = await process(batch);
  } catch (e) {
    // The whole batch failed (bad config, provider down…). Retrying right
    // away won't help, so pause with the reason and keep the batch pending.
    result = { doneIds: [], failures: [] };
    stepError = String(e instanceof Error ? e.message : e).slice(0, 300);
  }

  const latest = await getJob(db, kind);
  const handled = new Set([...result.doneIds, ...result.failures.map((f) => f.id)]);
  latest.pendingIds = latest.pendingIds.filter((id) => !handled.has(id));
  latest.done += result.doneIds.length;
  latest.failures = [...latest.failures, ...result.failures].slice(-MAX_FAILURES_KEPT);
  if (result.failures.length) latest.lastError = result.failures.at(-1)!.error;
  if (stepError) {
    latest.lastError = stepError;
    if (latest.status === "running") latest.status = "paused";
  }
  latest.lockedUntil = undefined;
  if (latest.pendingIds.length === 0 && latest.status === "running") {
    latest.status = "done";
    latest.finishedAt = Date.now();
  }
  await saveJob(db, latest);
  return latest;
}

export async function setJobStatus(
  db: D1Database,
  kind: JobKind,
  status: "running" | "paused",
): Promise<JobState> {
  const job = await getJob(db, kind);
  if (status === "paused" && job.status === "running") job.status = "paused";
  if (status === "running" && job.status === "paused") {
    job.status = job.pendingIds.length ? "running" : "done";
    job.lockedUntil = undefined;
    job.lastError = undefined;
  }
  await saveJob(db, job);
  return job;
}

/** Re-queues failed items. */
export async function retryFailures(db: D1Database, kind: JobKind): Promise<JobState> {
  const job = await getJob(db, kind);
  const ids = job.failures.map((f) => f.id);
  job.pendingIds = [...new Set([...job.pendingIds, ...ids])];
  job.failures = [];
  job.lastError = undefined;
  job.total = job.done + job.pendingIds.length;
  job.status = job.pendingIds.length ? "running" : job.status;
  job.finishedAt = undefined;
  job.lockedUntil = undefined;
  await saveJob(db, job);
  return job;
}
