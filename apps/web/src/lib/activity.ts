import type { ActivityLevel } from "@pickit/shared";
import { intlLocale, m } from "#lib/i18n";

export const ACTIVITY_LABELS: Record<ActivityLevel, () => string> = {
  active: m.activity_active,
  slowing: m.activity_slowing,
  stale: m.activity_stale,
  archived: m.activity_archived,
};

/** Badge colors: calm when active, warning once a project looks unmaintained. */
export const ACTIVITY_VARIANTS: Record<ActivityLevel, "success" | "secondary" | "warning" | "destructive"> = {
  active: "success",
  slowing: "secondary",
  stale: "warning",
  archived: "destructive",
};

/** Levels worth flagging on a card: the project may no longer be maintained. */
export const isUnmaintained = (level: ActivityLevel | null) => level === "stale" || level === "archived";

/** 12345 → "1.2万" / "12K". */
export const formatCompact = (n: number) =>
  new Intl.NumberFormat(intlLocale(), { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Why the latest check failed, for people. */
export function activityErrorText(error: string): string {
  if (error === "not_found") return m.activity_error_not_found();
  if (error === "rate_limited") return m.activity_error_rate_limited();
  return m.activity_error_other();
}
