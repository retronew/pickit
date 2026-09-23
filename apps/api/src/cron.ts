import type { Env, ItemRow } from "#types";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const CHECK_BATCH_SIZE = 50;
const CHECK_CONCURRENCY = 5;

export async function checkLink(url: string): Promise<number | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    return res.status;
  } catch {
    return null;
  }
}

export async function runDeadLinkCheck(env: Env) {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const { results } = await env.DB.prepare(
    `SELECT * FROM items WHERE deleted_at IS NULL AND url != ''
     AND (checked_at IS NULL OR checked_at < ?)
     ORDER BY checked_at IS NOT NULL, checked_at ASC
     LIMIT ?`,
  )
    .bind(cutoff, CHECK_BATCH_SIZE)
    .all<ItemRow>();

  let idx = 0;
  async function worker() {
    while (idx < results.length) {
      const row = results[idx++];
      const status = await checkLink(row.url);
      await env.DB.prepare(
        "UPDATE items SET http_status=?, checked_at=? WHERE id=?",
      )
        .bind(status, Date.now(), row.id)
        .run();
    }
  }
  await Promise.all(
    Array.from({ length: CHECK_CONCURRENCY }, () => worker()),
  );
}

export async function runDailyBackup(env: Env) {
  if (!env.BACKUPS) return;
  const { results } = await env.DB.prepare(
    "SELECT * FROM items WHERE deleted_at IS NULL ORDER BY id",
  ).all<ItemRow>();
  const items = results.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    icon: r.icon,
    note: r.note,
    category: r.category,
    tags: JSON.parse(r.tags || "[]"),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  const date = new Date().toISOString().slice(0, 10);
  await env.BACKUPS.put(`backups/pickit-${date}.json`, JSON.stringify(items));

  const list = await env.BACKUPS.list({ prefix: "backups/" });
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  for (const obj of list.objects) {
    if (obj.uploaded.getTime() < cutoff) {
      await env.BACKUPS.delete(obj.key);
    }
  }
}
