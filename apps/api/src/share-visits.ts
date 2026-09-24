// Visit tracking for public share links: lifetime counters on the share
// plus a pruned per-visit log for the stats on the shares page. A visitor
// is a hash of IP + user agent + share; their repeat views within
// REPEAT_MS count once (refreshes, back/forward, double requests).

import type { VisitKind } from "@pickit/shared";
import { parseUserAgent, type ParsedUserAgent } from "#user-agent";

export type { VisitKind };


const KEEP_MS = 180 * 24 * 60 * 60 * 1000;
const REPEAT_MS = 30 * 60 * 1000;
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless/i;

export interface VisitInfo extends ParsedUserAgent {
  kind: VisitKind;
  visitor: string;
  referrer: string;
  country: string;
}

const hostOf = (url: string | null | undefined) => {
  try {
    return new URL(url ?? "").host;
  } catch {
    return "";
  }
};

/** The referring site's host; "" for direct visits and links from PickIt itself. */
function refererHost(url: string | null | undefined, ownHosts: string[]): string {
  try {
    const host = new URL(url ?? "").host;
    return ownHosts.includes(host) ? "" : host;
  } catch {
    return ""; // No or invalid referrer: a direct visit.
  }
}

async function visitorId(ip: string, ua: string, slug: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${ua}|${slug}`));
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * What to log about a request; null for crawlers and link-preview bots.
 * `pageReferrer` is the share page's document.referrer: the page loads its
 * data with fetch, whose Referer header is the share page itself.
 */
export async function visitInfo(
  req: Request,
  kind: VisitKind,
  slug: string,
  ownHosts: string[],
  pageReferrer?: string,
): Promise<VisitInfo | null> {
  const ua = req.headers.get("user-agent") ?? "";
  // Feed readers identify as bots too; count those fetches as RSS anyway.
  if (kind === "page" && BOT_UA.test(ua)) return null;
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "";
  const cf = (req as Request & { cf?: { country?: string } }).cf;
  return {
    kind,
    visitor: await visitorId(ip, ua, slug),
    // The page's own fetch sends the share page as Referer: that host is ours too.
    referrer: refererHost(pageReferrer ?? req.headers.get("referer"), [
      ...ownHosts,
      ...(pageReferrer ? [hostOf(req.headers.get("referer"))] : []),
    ]),
    country: cf?.country ?? "",
    ...parseUserAgent(ua),
  };
}

/** Logs a visit unless the same visitor viewed this share within REPEAT_MS. */
export async function recordVisit(db: D1Database, slug: string, visit: VisitInfo, now = Date.now()) {
  const repeat = await db
    .prepare("SELECT 1 FROM share_visits WHERE slug = ? AND visitor = ? AND kind = ? AND at > ? LIMIT 1")
    .bind(slug, visit.visitor, visit.kind, now - REPEAT_MS)
    .first();
  if (repeat) return;
  await db.batch([
    db
      .prepare("UPDATE shares SET view_count = view_count + 1, last_viewed_at = ? WHERE slug = ?")
      .bind(now, slug),
    db
      .prepare(
        `INSERT INTO share_visits (slug, at, kind, visitor, referrer, country, browser, os, device)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(slug, now, visit.kind, visit.visitor, visit.referrer, visit.country, visit.browser, visit.os, visit.device),
    db.prepare("DELETE FROM share_visits WHERE at < ?").bind(now - KEEP_MS),
  ]);
}
