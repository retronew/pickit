// Background backfill of preview images for items saved before they existed
// (or added without "AI analyze").

import { fetchPageMeta } from "#page-meta";

/** Small per run: it rides the per-minute cron next to the job runners. */
const BATCH_SIZE = 5;

/**
 * Fetches previews for a few items never tried before. Each is marked tried
 * even when the page has no image, so it isn't fetched again every minute.
 * Returns how many items were tried.
 */
export async function backfillPreviews(db: D1Database): Promise<number> {
  const { results } = await db
    .prepare(
      `SELECT id, url FROM items
       WHERE deleted_at IS NULL AND url != '' AND image = '' AND preview_checked_at IS NULL
       ORDER BY id DESC LIMIT ?`,
    )
    .bind(BATCH_SIZE)
    .all<{ id: number; url: string }>();

  await Promise.all(
    results.map(async (row) => {
      const { image } = await fetchPageMeta(row.url);
      await db
        .prepare("UPDATE items SET image=?, preview_checked_at=? WHERE id=?")
        .bind(image, Date.now(), row.id)
        .run();
    }),
  );
  return results.length;
}
