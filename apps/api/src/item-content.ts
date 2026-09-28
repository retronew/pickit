// Page text snapshots of bookmarks, stored in R2 as content/<id>.txt: plain
// text, or Markdown when Browser Rendering made it (see page-capture.ts). A
// snapshot is what the page said when it was captured: it is never synced
// with the live page, only replaced by an explicit refetch. Without an R2
// bucket the feature is off.

import type { Env } from "#types";
import { capturePage } from "#page-capture";

const PREFIX = "content/";
/** Small per run: rides the per-minute cron like the preview backfill. */
const BACKFILL_BATCH = 3;

export type ContentStatus = "" | "ok" | "empty" | "failed";

const key = (id: number) => `${PREFIX}${id}.txt`;

export const contentEnabled = (env: Pick<Env, "BACKUPS">) => !!env.BACKUPS;

/** Waits before retrying after the 1st, 2nd and 3rd failure in a row; then it stops. */
const RETRY_DELAYS = [1, 3, 7].map((days) => days * 86_400_000);

/**
 * Fetches the page, stores its text and records the outcome on the item.
 * "deferred": nothing done, a later batch comes back to it. "unchanged": an
 * upgrade to Markdown didn't work out and the snapshot was kept.
 */
export async function captureContent(
  env: Env,
  id: number,
  url: string,
  opts: { background?: boolean; upgrade?: boolean } = {},
): Promise<ContentStatus | "deferred" | "unchanged"> {
  if (!env.BACKUPS || !url) return "";
  const result = await capturePage(env, url, opts);
  const now = Date.now();
  if (result.ok === "deferred") return "deferred";
  if (result.ok === "unchanged") {
    await env.DB.prepare("UPDATE items SET content_rendered_at = ? WHERE id = ?").bind(now, id).run();
    return "unchanged";
  }
  const renderedAt = result.rendered ? now : null;
  if (!result.ok) {
    // Keep an older snapshot: a page that is down now still has its old text.
    // Try again later, a little further apart each time.
    await env.DB.prepare(
      `UPDATE items SET content_status = CASE WHEN content_status = 'ok' THEN 'ok' ELSE 'failed' END,
         content_at = COALESCE(content_at, ?1),
         content_attempts = content_attempts + 1,
         content_due_at = CASE content_attempts + 1 WHEN 1 THEN ?1 + ?2 WHEN 2 THEN ?1 + ?3 WHEN 3 THEN ?1 + ?4 ELSE NULL END,
         content_rendered_at = COALESCE(?5, content_rendered_at)
       WHERE id = ?6`,
    )
      .bind(now, ...RETRY_DELAYS, renderedAt, id)
      .run();
    return "failed";
  }
  let size: number | null = null;
  if (!result.text) {
    await env.BACKUPS.delete(key(id));
  } else {
    const bytes = new TextEncoder().encode(result.text);
    size = bytes.byteLength;
    const contentType = result.format === "markdown" ? "text/markdown" : "text/plain";
    await env.BACKUPS.put(key(id), bytes, { httpMetadata: { contentType: `${contentType}; charset=utf-8` } });
  }
  const status: ContentStatus = result.text ? "ok" : "empty";
  await env.DB.prepare(
    `UPDATE items SET content_status = ?, content_at = ?, content_size = ?, content_format = ?,
       content_attempts = 0, content_due_at = NULL, content_rendered_at = COALESCE(?, content_rendered_at)
     WHERE id = ?`,
  )
    .bind(status, now, size, result.format, renderedAt, id)
    .run();
  return status;
}

/** A bookmark's URL changed: its snapshot is of the old page, so capture the new one (and let it be upgraded again). */
export async function recaptureForNewUrl(env: Env, id: number, url: string) {
  await env.DB.prepare(
    "UPDATE items SET content_attempts = 0, content_due_at = NULL, content_rendered_at = NULL WHERE id = ?",
  )
    .bind(id)
    .run();
  await captureContent(env, id, url);
}

/** Schedules every bookmark to be captured again by the backfill; returns how many. */
export async function scheduleRecaptureAll(env: Env): Promise<number> {
  const { meta } = await env.DB.prepare(
    "UPDATE items SET content_due_at = ?, content_attempts = 0 WHERE deleted_at IS NULL AND url != ''",
  )
    .bind(Date.now())
    .run();
  return meta.changes ?? 0;
}

export async function readContent(env: Env, id: number): Promise<string | null> {
  const obj = await env.BACKUPS?.get(key(id));
  return obj ? obj.text() : null;
}

export async function deleteContent(env: Env, ids: number[]) {
  if (env.BACKUPS && ids.length) await env.BACKUPS.delete(ids.map(key));
}

/**
 * What the backfill works on, most important first: bookmarks never
 * captured, then ones due again (a retry after a failure, or "recapture
 * all"), then plain-text snapshots Browser Rendering hasn't tried yet, to turn
 * them into Markdown (only while it's on, and within part of its limit).
 *
 * All three are read in one statement (a UNION ALL, queue order kept by `q`),
 * and each branch goes through its own partial index (migration 0019) so an
 * empty queue costs next to no row reads; left alone, SQLite picks
 * idx_items_deleted and scans every live item.
 */
const BACKFILL_QUEUES: { where: string; order: string; index: string; upgrade?: boolean }[] = [
  { where: "content_status = ''", order: "id DESC", index: "idx_items_content_backfill" },
  { where: "content_due_at <= ?1", order: "content_due_at, id DESC", index: "idx_items_content_due_live" },
  {
    index: "idx_items_content_upgrade",
    where: "content_status IN ('ok', 'empty') AND content_format != 'markdown' AND content_rendered_at IS NULL",
    order: "id DESC",
    upgrade: true,
  },
];

const BACKFILL_SQL = BACKFILL_QUEUES.map(
  (queue, i) =>
    `SELECT * FROM (SELECT id, url, ${i} AS q FROM items INDEXED BY ${queue.index}
       WHERE deleted_at IS NULL AND url != '' AND ${queue.where} ORDER BY ${queue.order} LIMIT ?2)`,
).join(" UNION ALL ");

/**
 * Captures a few bookmarks from the queues above, one at a time, stopping
 * when Browser Rendering asks to wait (free plan: one render per 10 seconds);
 * the rest are picked up on the next run.
 */
export async function backfillContent(env: Env): Promise<number> {
  if (!env.BACKUPS) return 0;
  const { results } = await env.DB.prepare(BACKFILL_SQL)
    .bind(Date.now(), BACKFILL_BATCH)
    .all<{ id: number; url: string; q: number }>();
  let done = 0;
  const seen = new Set<number>();
  // UNION ALL keeps each branch's rows together, in queue order.
  for (const r of results) {
    if (done >= BACKFILL_BATCH) break;
    // An item can sit in two queues (due again and not yet Markdown); capture it once.
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const status = await captureContent(env, r.id, r.url, {
      background: true,
      upgrade: BACKFILL_QUEUES[r.q].upgrade,
    }).catch(() => "failed" as const);
    if (status === "deferred") return done;
    done++;
  }
  return done;
}
