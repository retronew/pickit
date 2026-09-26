// Cloudflare Browser Rendering for page text snapshots: renders the page in a
// real browser (so JavaScript-built pages work) and returns Markdown. Its
// browser time is metered, so PickIt caps its own use below the plan's quota.

/** "free": Workers Free (10 min a day); "paid": Workers Paid (10 h a month included). */
export type BrowserRenderPlan = "free" | "paid";

export interface BrowserRenderSettings {
  enabled: boolean;
  plan: BrowserRenderPlan;
  accountId: string;
  /** Browser minutes PickIt may use per day (free) or per month (paid). */
  limitMinutes: number;
}

/** The plan's own quota, the most a limit can be set to on the free plan. */
export const BROWSER_PLAN_QUOTA: Record<BrowserRenderPlan, { minutes: number; period: "day" | "month" }> = {
  free: { minutes: 10, period: "day" },
  paid: { minutes: 600, period: "month" },
};

/** Defaults leave headroom under the quota, since usage is only known after each call. */
export const BROWSER_DEFAULT_LIMIT: Record<BrowserRenderPlan, number> = { free: 8, paid: 540 };

/** Paid overage is billed, so even a raised limit stays bounded. */
export const BROWSER_MAX_LIMIT_MINUTES = 6000;

export function defaultBrowserRenderSettings(): BrowserRenderSettings {
  return { enabled: false, plan: "free", accountId: "", limitMinutes: BROWSER_DEFAULT_LIMIT.free };
}

/** A limit within what the plan allows: the free quota can't be exceeded at all. */
export function clampBrowserLimit(plan: BrowserRenderPlan, minutes: number): number {
  const max = plan === "free" ? BROWSER_PLAN_QUOTA.free.minutes : BROWSER_MAX_LIMIT_MINUTES;
  if (!Number.isFinite(minutes)) return BROWSER_DEFAULT_LIMIT[plan];
  return Math.min(max, Math.max(1, Math.round(minutes)));
}

export function sanitizeBrowserRenderSettings(raw: unknown): BrowserRenderSettings {
  const base = defaultBrowserRenderSettings();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const plan: BrowserRenderPlan = r.plan === "paid" ? "paid" : "free";
  return {
    enabled: r.enabled === true,
    plan,
    accountId: typeof r.accountId === "string" ? r.accountId.trim().slice(0, 64) : "",
    limitMinutes: clampBrowserLimit(plan, typeof r.limitMinutes === "number" ? r.limitMinutes : BROWSER_DEFAULT_LIMIT[plan]),
  };
}

/** Settings plus what the settings page shows about the token and usage. */
export interface BrowserRenderInfo extends BrowserRenderSettings {
  /** Masked API token, null when none is saved. */
  tokenMasked: string | null;
  /** Browser time used in the current period (UTC day or month). */
  usedMs: number;
  period: "day" | "month";
  /** When the current period ends and usage starts over. */
  resetsAt: number;
}
