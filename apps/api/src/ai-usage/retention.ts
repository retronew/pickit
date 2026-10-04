// How long AI usage rows are kept (settings key `ai_usage_retention_days`,
// 0 = forever). Same limits as the audit log.

import type { AiUsageRetention } from "@pickit/shared";
import { readSetting, writeSetting } from "#settings-store";
import { MAX_RETENTION_DAYS } from "#audit/index";

export const DEFAULT_RETENTION_DAYS = 180;
const KEY = "ai_usage_retention_days";
const DAY_MS = 86_400_000;

export async function getRetentionDays(db: D1Database): Promise<number> {
  const raw = await readSetting(db, KEY);
  const days = raw !== null ? Number(raw) : DEFAULT_RETENTION_DAYS;
  return Number.isInteger(days) && days >= 0 ? days : DEFAULT_RETENTION_DAYS;
}

export async function setRetentionDays(db: D1Database, days: number) {
  await writeSetting(db, KEY, String(days));
}

/** Deletes rows older than the retention window; returns how many. */
export async function pruneAiUsage(db: D1Database, days?: number): Promise<number> {
  const keep = days ?? (await getRetentionDays(db));
  if (keep === 0) return 0;
  const res = await db
    .prepare("DELETE FROM ai_usage WHERE created_at < ?")
    .bind(Date.now() - keep * DAY_MS)
    .run();
  return res.meta.changes ?? 0;
}

export async function retentionInfo(db: D1Database): Promise<AiUsageRetention> {
  const [retentionDays, row] = await Promise.all([
    getRetentionDays(db),
    db
      .prepare("SELECT COUNT(*) AS count, MIN(created_at) AS oldest FROM ai_usage")
      .first<{ count: number; oldest: number | null }>(),
  ]);
  return {
    retentionDays,
    maxRetentionDays: MAX_RETENTION_DAYS,
    count: row?.count ?? 0,
    oldest: row?.oldest ?? null,
  };
}
