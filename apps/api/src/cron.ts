import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { findArchiveUrl } from "#archive";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
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

export const isBroken = (status: number | null) => status == null || status >= 400;

/**
 * Checks one item's link and stores the result. A dead link without an
 * archive yet gets its closest Wayback Machine snapshot looked up.
 */
export async function recordLinkCheck(db: D1Database, row: Pick<ItemRow, "id" | "url" | "archive_url">) {
  const status = await checkLink(row.url);
  const checkedAt = Date.now();
  const archiveUrl = isBroken(status) && !row.archive_url ? await findArchiveUrl(row.url) : row.archive_url;
  await db
    .prepare("UPDATE items SET http_status=?, checked_at=?, archive_url=? WHERE id=?")
    .bind(status, checkedAt, archiveUrl, row.id)
    .run();
  return { status, checkedAt, archiveUrl };
}

export async function runDeadLinkCheck(env: Env) {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const { results } = await env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM items WHERE deleted_at IS NULL AND url != ''
     AND (checked_at IS NULL OR checked_at < ?)
     ORDER BY checked_at IS NOT NULL, checked_at ASC
     LIMIT ?`,
  )
    .bind(cutoff, CHECK_BATCH_SIZE)
    .all<ItemRow>();

  let idx = 0;
  let broken = 0;
  async function worker() {
    while (idx < results.length) {
      const row = results[idx++];
      const { status } = await recordLinkCheck(env.DB, row);
      if (isBroken(status)) broken++;
    }
  }
  await Promise.all(
    Array.from({ length: CHECK_CONCURRENCY }, () => worker()),
  );
  return { checked: results.length, broken };
}
