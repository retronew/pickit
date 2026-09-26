// Cloudflare Browser Rendering (/markdown) for page text snapshots. Browser
// time is metered, so PickIt keeps its own tally per UTC day (free plan) or
// month (paid plan) and stops calling once the configured limit is reached;
// the free plan's one request per 10 seconds is respected too.

import {
  BROWSER_PLAN_QUOTA,
  sanitizeBrowserRenderSettings,
  type BrowserRenderInfo,
  type BrowserRenderPlan,
  type BrowserRenderSettings,
} from "@pickit/shared";
import { MAX_TEXT } from "#page-text";

const SETTINGS_KEY = "browser_render";
const TOKEN_KEY = "browser_render_token";
const USAGE_PREFIX = "browser_usage:";
const LAST_CALL_KEY = "browser_render_last";
/** Workers Free allows one Browser Rendering REST request every 10 seconds. */
const FREE_MIN_INTERVAL_MS = 10_000;
/** The browser gives up after 60 s; wait a little longer for the response. */
const REQUEST_TIMEOUT_MS = 70_000;

const API = "https://api.cloudflare.com/client/v4";

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
}

export const getBrowserRenderToken = (db: D1Database) => getValue(db, TOKEN_KEY).then((v) => v || null);

export async function setBrowserRenderToken(db: D1Database, token: string | null) {
  if (token) await setValue(db, TOKEN_KEY, token);
  else await db.prepare("DELETE FROM settings WHERE key = ?").bind(TOKEN_KEY).run();
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

export async function getBrowserRenderInfo(db: D1Database, now = Date.now()): Promise<BrowserRenderInfo> {
  const settings = await getBrowserRenderSettings(db);
  const token = await getBrowserRenderToken(db);
  return {
    ...settings,
    tokenMasked: token ? `${token.slice(0, 4)}****${token.slice(-4)}` : null,
    usedMs: await readUsageMs(db, settings.plan, now),
    period: BROWSER_PLAN_QUOTA[settings.plan].period,
    resetsAt: usagePeriod(settings.plan, now).resetsAt,
  };
}

export type BrowserAccess =
  | { ok: true; plan: BrowserRenderPlan; accountId: string; token: string }
  | { ok: false; reason: "off" | "budget" | "throttled" };

/**
 * Whether a render may start now. On the free plan it also claims the
 * 10-second slot, atomically, so two captures can't both take it.
 */
export async function acquireBrowser(db: D1Database, now = Date.now()): Promise<BrowserAccess> {
  const settings = await getBrowserRenderSettings(db);
  const token = await getBrowserRenderToken(db);
  if (!settings.enabled || !settings.accountId || !token) return { ok: false, reason: "off" };
  if ((await readUsageMs(db, settings.plan, now)) >= settings.limitMinutes * 60_000) return { ok: false, reason: "budget" };
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
  return { ok: true, plan: settings.plan, accountId: settings.accountId, token };
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
 * the browser time it took. The time comes from X-Browser-Ms-Used when
 * Cloudflare sends it, else the request's wall time, which overcounts.
 */
export async function renderMarkdown(
  db: D1Database,
  access: Extract<BrowserAccess, { ok: true }>,
  input: RenderInput,
): Promise<RenderResult> {
  const started = Date.now();
  let res: Response | null = null;
  try {
    res = await fetch(`${API}/accounts/${access.accountId}/browser-rendering/markdown`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        "url" in input
          ? { url: input.url, rejectResourceTypes: ["image", "media", "font"] }
          : { html: input.html, rejectResourceTypes: ["image", "media", "font"] },
      ),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
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

/** Checks an API token with Cloudflare (free: no browser time). Account tokens and user tokens verify differently. */
export async function verifyBrowserToken(accountId: string, token: string): Promise<boolean> {
  const headers = { Authorization: `Bearer ${token}` };
  for (const url of [`${API}/accounts/${accountId}/tokens/verify`, `${API}/user/tokens/verify`]) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    const data = await res?.json<{ success?: boolean; result?: { status?: string } }>().catch(() => null);
    if (data?.success && data.result?.status === "active") return true;
  }
  return false;
}
