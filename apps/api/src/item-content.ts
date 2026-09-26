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

/**
 * Fetches the page, stores its text and records the outcome on the item.
 * In the background it may defer (returns "" and leaves the item untouched).
 */
export async function captureContent(
  env: Env,
  id: number,
  url: string,
  { background = false } = {},
): Promise<ContentStatus> {
  if (!env.BACKUPS || !url) return "";
  const result = await capturePage(env, url, { background });
  if (result.ok === "deferred") return "";
  let status: ContentStatus;
  let size: number | null = null;
  if (!result.ok) {
    // Keep an older snapshot: a page that is down now still has its old text.
    status = "failed";
  } else if (!result.text) {
    status = "empty";
    await env.BACKUPS.delete(key(id));
  } else {
    status = "ok";
    const bytes = new TextEncoder().encode(result.text);
    size = bytes.byteLength;
    await env.BACKUPS.put(key(id), bytes, { httpMetadata: { contentType: "text/markdown; charset=utf-8" } });
  }
  await env.DB.prepare(
    status === "failed"
      ? "UPDATE items SET content_status = CASE WHEN content_status = 'ok' THEN 'ok' ELSE ? END, content_at = COALESCE(content_at, ?) WHERE id = ?"
      : "UPDATE items SET content_status = ?, content_at = ?, content_size = ? WHERE id = ?",
  )
    .bind(...(status === "failed" ? [status, Date.now(), id] : [status, Date.now(), size, id]))
    .run();
  return status;
}

export async function readContent(env: Env, id: number): Promise<string | null> {
  const obj = await env.BACKUPS?.get(key(id));
  return obj ? obj.text() : null;
}

export async function deleteContent(env: Env, ids: number[]) {
  if (env.BACKUPS && ids.length) await env.BACKUPS.delete(ids.map(key));
}

/**
 * Captures text for a few bookmarks never tried before, newest first. One at
 * a time, stopping when Browser Rendering asks to wait (free plan: one render
 * per 10 seconds); the rest are picked up on the next run.
 */
export async function backfillContent(env: Env): Promise<number> {
  if (!env.BACKUPS) return 0;
  const { results } = await env.DB.prepare(
    `SELECT id, url FROM items WHERE deleted_at IS NULL AND url != '' AND content_status = ''
     ORDER BY id DESC LIMIT ?`,
  )
    .bind(BACKFILL_BATCH)
    .all<{ id: number; url: string }>();
  let done = 0;
  for (const r of results) {
    const status = await captureContent(env, r.id, r.url, { background: true }).catch(() => "failed" as const);
    if (!status) break;
    done++;
  }
  return done;
}
