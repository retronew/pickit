import type { AiFeature, AiUsageKind } from "@pickit/shared";
import { intlLocale, m } from "#lib/i18n";

export const AI_FEATURE_LABELS: Record<AiFeature, () => string> = {
  analyze: m.ai_usage_feature_analyze,
  organize: m.ai_usage_feature_organize,
  summarize: m.ai_usage_feature_summarize,
  translate: m.ai_usage_feature_translate,
  chat: m.ai_usage_feature_chat,
  search: m.ai_usage_feature_search,
  embed: m.ai_usage_feature_embed,
  test: m.ai_usage_feature_test,
};

export const AI_KIND_LABELS: Record<AiUsageKind, () => string> = {
  chat: m.ai_usage_kind_chat,
  embedding: m.ai_usage_kind_embedding,
};

/** 1234567 → "1.2M" (or "123万" in Chinese). */
export function formatTokens(n: number): string {
  return new Intl.NumberFormat(intlLocale(), { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatCount(n: number): string {
  return n.toLocaleString(intlLocale());
}

/**
 * "2026-10-04" → "10/04" in the UI language. The string is already a local
 * date of the viewer's zone, so it is formatted as-is (in UTC, no shifting).
 */
export function formatDay(day: string): string {
  const [y, mo, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(), { month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(
    Date.UTC(y, mo - 1, d),
  );
}
