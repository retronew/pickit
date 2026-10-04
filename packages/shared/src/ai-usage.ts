// Token usage of AI calls: returned by GET /api/ai-usage and shown on the
// stats page. Rows are stored as absolute instants (epoch ms); which day a call
// belongs to is worked out per request in the viewer's IANA time zone, so DST
// and half-hour zones bucket correctly and a zone change just regroups.

export type AiUsageKind = "chat" | "embedding";

/** What the call was for. */
export type AiFeature =
  | "analyze"
  | "organize"
  | "summarize"
  | "translate"
  | "chat"
  | "search"
  | "embed"
  | "test";

export const AI_USAGE_RANGES = [7, 30, 90] as const;

export interface AiUsageTotals {
  calls: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AiUsageDay extends AiUsageTotals {
  /** Local date in the requested zone, YYYY-MM-DD. */
  day: string;
}

export interface AiUsageModel extends AiUsageTotals {
  kind: AiUsageKind;
  provider: string;
  model: string;
}

export interface AiUsageFeature extends AiUsageTotals {
  feature: AiFeature;
}

export interface AiUsageReport {
  timeZone: string;
  totals: AiUsageTotals;
  /** Oldest first, one entry per day, gaps filled with zeros. */
  byDay: AiUsageDay[];
  byModel: AiUsageModel[];
  byFeature: AiUsageFeature[];
}

export interface AiUsageRetention {
  retentionDays: number;
  maxRetentionDays: number;
  count: number;
  oldest: number | null;
}

const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function parts(ms: number, timeZone: string) {
  const p = Object.fromEntries(formatter(timeZone).formatToParts(ms).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** The local date (YYYY-MM-DD) of an instant in `timeZone`. */
export function localDay(ms: number, timeZone: string): string {
  const { y, mo, d } = parts(ms, timeZone);
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Offset of `timeZone` from UTC at `ms`, in ms (east positive). */
function offsetAt(ms: number, timeZone: string): number {
  const { y, mo, d, h, mi, s } = parts(ms, timeZone);
  return Date.UTC(y, mo - 1, d, h, mi, s) - Math.floor(ms / 1000) * 1000;
}

/** The instant local midnight starts `day` (YYYY-MM-DD) in `timeZone`. */
export function startOfLocalDay(day: string, timeZone: string): number {
  const [y, mo, d] = day.split("-").map(Number);
  const wall = Date.UTC(y, mo - 1, d);
  // Two passes settle the offset even when midnight sits next to a DST switch.
  let t = wall - offsetAt(wall, timeZone);
  t = wall - offsetAt(t, timeZone);
  return t;
}

/** The last `days` local dates up to and including today, oldest first. */
export function recentDays(days: number, timeZone: string, now = Date.now()): string[] {
  const out: string[] = [];
  const today = localDay(now, timeZone);
  const [y, mo, d] = today.split("-").map(Number);
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(Date.UTC(y, mo - 1, d) - i * DAY_MS).toISOString().slice(0, 10));
  }
  return out;
}

export const emptyTotals = (): AiUsageTotals => ({ calls: 0, failed: 0, inputTokens: 0, outputTokens: 0 });

export function addTotals(into: AiUsageTotals, row: AiUsageTotals) {
  into.calls += row.calls;
  into.failed += row.failed;
  into.inputTokens += row.inputTokens;
  into.outputTokens += row.outputTokens;
}

/** Sums time buckets (bucket start in epoch ms) into local days, filling gaps. */
export function bucketByDay(
  buckets: (AiUsageTotals & { at: number })[],
  days: string[],
  timeZone: string,
): AiUsageDay[] {
  const byDay = new Map(days.map((day) => [day, { day, ...emptyTotals() }]));
  for (const b of buckets) {
    const row = byDay.get(localDay(b.at, timeZone));
    if (row) addTotals(row, b);
  }
  return [...byDay.values()];
}
