export interface JobState {
  total: number;
  done: number;
  failedIds: number[];
  running: boolean;
  startedAt: number;
  finishedAt?: number;
}

export async function getJob(db: D1Database, key: string): Promise<JobState | null> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as JobState;
  } catch {
    return null;
  }
}

export async function saveJob(db: D1Database, key: string, job: JobState) {
  await db
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .bind(key, JSON.stringify(job))
    .run();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBatchJob<T extends { id: number }>(
  db: D1Database,
  key: string,
  rows: T[],
  job: JobState,
  handler: (row: T) => Promise<void>,
) {
  for (const row of rows) {
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      if (attempt > 0) await sleep(1000 * attempt);
      try {
        await handler(row);
        ok = true;
      } catch {
        // retry with backoff, fall through to next attempt
      }
    }
    if (ok) job.done += 1;
    else if (!job.failedIds.includes(row.id)) job.failedIds.push(row.id);
    await saveJob(db, key, job);
  }
  job.running = false;
  job.finishedAt = Date.now();
  await saveJob(db, key, job);
}
