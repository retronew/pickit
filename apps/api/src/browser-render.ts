// Cloudflare Browser Rendering (the markdown quick action, through the
// BROWSER binding, so no account ID or API token) for page text snapshots.
// Browser time is metered, so PickIt keeps its own tally per UTC day (free plan) or
// month (paid plan) and stops calling once the configured limit is reached;
// the free plan's one request per 10 seconds is respected too.

import {
  BROWSER_PLAN_QUOTA,
  sanitizeBrowserRenderSettings,
  type BrowserRenderInfo,
  type BrowserRenderPlan,
  type BrowserRenderSettings,
} from "@pickit/shared";
import type { Env } from "#types";
import { MAX_TEXT } from "#page-text";

const SETTINGS_KEY = "browser_render";
const USAGE_PREFIX = "browser_usage:";
const LAST_CALL_KEY = "browser_render_last";
/** Workers Free allows one Browser Rendering REST request every 10 seconds. */
const FREE_MIN_INTERVAL_MS = 10_000;

async function getValue(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

async function setValue(db: D1Database, key: string, value: string) {
  await db
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(key, value)
    .run();
}

export async function getBrowserRenderSettings(db: D1Database): Promise<BrowserRenderSettings> {
  const raw = await getValue(db, SETTINGS_KEY);
  try {
    return sanitizeBrowserRenderSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeBrowserRenderSettings(null);
  }
}

export async function saveBrowserRenderSettings(db: D1Database, settings: BrowserRenderSettings) {
  await setValue(db, SETTINGS_KEY, JSON.stringify(sanitizeBrowserRenderSettings(settings)));
  // The API token of the first version (before the BROWSER binding) is no longer used.
  await db.prepare("DELETE FROM settings WHERE key = 'browser_render_token'").run();
}

/** The usage bucket `now` falls in: a UTC day on the free plan, a UTC month on paid. */
export function usagePeriod(plan: BrowserRenderPlan, now: number): { key: string; resetsAt: number } {
  const d = new Date(now);
  if (BROWSER_PLAN_QUOTA[plan].period === "day") {
    return {
      key: `${USAGE_PREFIX}d:${d.toISOString().slice(0, 10)}`,
      resetsAt: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1),
    };
  }
  return {
    key: `${USAGE_PREFIX}m:${d.toISOString().slice(0, 7)}`,
    resetsAt: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1),
  };
}

export async function readUsageMs(db: D1Database, plan: BrowserRenderPlan, now = Date.now()): Promise<number> {
  return Number(await getValue(db, usagePeriod(plan, now).key)) || 0;
}

/** Adds browser time to the current period, and drops older periods' tallies. */
async function addUsageMs(db: D1Database, plan: BrowserRenderPlan, ms: number, now = Date.now()) {
  const { key } = usagePeriod(plan, now);
  await db.batch([
    db
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + excluded.value",
      )
      .bind(key, String(Math.max(0, Math.round(ms)))),
    db.prepare("DELETE FROM settings WHERE key LIKE ? AND key != ?").bind(`${USAGE_PREFIX}%`, key),
  ]);
}

export async function getBrowserRenderInfo(env: Pick<Env, "DB" | "BROWSER">, now = Date.now()): Promise<BrowserRenderInfo> {
  const db = env.DB;
  const settings = await getBrowserRenderSettings(db);
  return {
    ...settings,
    available: !!env.BROWSER,
    usedMs: await readUsageMs(db, settings.plan, now),
    period: BROWSER_PLAN_QUOTA[settings.plan].period,
    resetsAt: usagePeriod(settings.plan, now).resetsAt,
  };
}

export type BrowserAccess =
  | { ok: true; plan: BrowserRenderPlan; browser: BrowserRun }
  | { ok: false; reason: "off" | "budget" | "throttled" };

/**
 * Whether a render may start now. On the free plan it also claims the
 * 10-second slot, atomically, so two captures can't both take it.
 */
export async function acquireBrowser(
  env: Pick<Env, "DB" | "BROWSER">,
  now = Date.now(),
  /** The share of the limit this use may reach (lower for less important work). */
  budgetShare = 1,
): Promise<BrowserAccess> {
  const db = env.DB;
  const settings = await getBrowserRenderSettings(db);
  if (!settings.enabled || !env.BROWSER) return { ok: false, reason: "off" };
  const limitMs = settings.limitMinutes * 60_000 * budgetShare;
  if ((await readUsageMs(db, settings.plan, now)) >= limitMs) return { ok: false, reason: "budget" };
  if (settings.plan === "free") {
    const claimed = await db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value
         WHERE CAST(settings.value AS INTEGER) <= ?`,
      )
      .bind(LAST_CALL_KEY, String(now), now - FREE_MIN_INTERVAL_MS)
      .run();
    if (!claimed.meta.changes) return { ok: false, reason: "throttled" };
  }
  return { ok: true, plan: settings.plan, browser: env.BROWSER };
}

/** Markdown fit for storing: no front matter, links absolute, length capped. */
export function tidyMarkdown(markdown: string, baseUrl: string): string {
  const body = markdown.replace(/^﻿?---\n[\s\S]*?\n---\n/, "");
  // Relative links and images (from a page's own HTML) would break in the reader.
  const absolute = body.replace(/(\]\()([^)\s]+)/g, (whole, open: string, href: string) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(href)) return whole;
    try {
      return open + new URL(href, baseUrl).href;
    } catch {
      return whole;
    }
  });
  const text = absolute.replace(/\n{3,}/g, "\n\n").trim();
  return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
}

export type RenderInput = { url: string } | { html: string; baseUrl: string };

export type RenderResult = { ok: true; markdown: string } | { ok: false; error: string };

/**
 * Renders a page (by URL, or HTML we already have) to Markdown and records
 * the browser time it took: X-Browser-Ms-Used, else the call's wall time
 * (which overcounts).
 */
export async function renderMarkdown(
  db: D1Database,
  access: Extract<BrowserAccess, { ok: true }>,
  input: RenderInput,
): Promise<RenderResult> {
  const started = Date.now();
  let res: Response | null = null;
  try {
    res = await access.browser.quickAction(
      "markdown",
      "url" in input
        ? { url: input.url, rejectResourceTypes: ["image", "media", "font"] }
        : { html: input.html, rejectResourceTypes: ["image", "media", "font"] },
    );
    const data = await res.json<{ success?: boolean; result?: unknown; errors?: { message?: string }[] }>().catch(() => null);
    if (res.status === 429 && /time limit/i.test(JSON.stringify(data ?? ""))) {
      // Cloudflare says the quota is used up: stop until the period resets.
      const settings = await getBrowserRenderSettings(db);
      const used = await readUsageMs(db, access.plan);
      await addUsageMs(db, access.plan, Math.max(0, settings.limitMinutes * 60_000 - used));
      res = null;
      return { ok: false, error: "browser time limit exceeded" };
    }
    if (!res.ok || !data?.success || typeof data.result !== "string") {
      return { ok: false, error: data?.errors?.[0]?.message?.slice(0, 200) || `HTTP ${res.status}` };
    }
    return { ok: true, markdown: tidyMarkdown(data.result, "url" in input ? input.url : input.baseUrl) };
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 200) };
  } finally {
    if (res) {
      const reported = Number(res.headers.get("X-Browser-Ms-Used"));
      await addUsageMs(db, access.plan, reported > 0 ? reported : Date.now() - started).catch(() => {});
    } else if (Date.now() - started > 1000) {
      // Timed out or failed mid-render: the browser likely ran anyway.
      await addUsageMs(db, access.plan, Date.now() - started).catch(() => {});
    }
  }
}
