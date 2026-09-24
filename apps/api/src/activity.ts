// Project activity of GitHub / npm bookmarks. GitHub allows 60 anonymous API
// requests an hour per IP (shared on Workers), so a token is used when there
// is one (5,000 an hour): the one saved on the settings page, else the
// GITHUB_TOKEN secret. A failed check keeps the previous data and records the error.

import { parseProjectUrl, type ProjectActivity, type ProjectRef } from "@pickit/shared";
import type { Env } from "#types";
import { getGithubToken } from "#settings";

const TIMEOUT_MS = 8000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** How often a project is checked again. */
export const RECHECK_MS = 7 * DAY_MS;
/** Small per run: rides the per-minute cron like the other backfills. */
const BACKFILL_BATCH = 3;

const time = (iso: unknown) => (typeof iso === "string" && !Number.isNaN(Date.parse(iso)) ? Date.parse(iso) : null);

class CheckError extends Error {}

async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) throw new CheckError("not_found");
  if (res.status === 403 || res.status === 429) throw new CheckError("rate_limited");
  if (!res.ok) throw new CheckError(`http_${res.status}`);
  return res.json();
}

async function checkGithub(ref: { owner: string; repo: string }, token?: string): Promise<Omit<ProjectActivity, "checkedAt">> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "PickIt",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const base = `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;
  const repo = (await getJson(base, headers)) as { pushed_at?: string; stargazers_count?: number; archived?: boolean };
  // Extra detail only: many repos publish no releases (404), and a failure
  // here shouldn't discard the repository data above.
  const release = (await getJson(`${base}/releases/latest`, headers).catch(() => null)) as {
    tag_name?: string;
    published_at?: string;
  } | null;
  return {
    source: "github",
    lastActivityAt: time(repo.pushed_at),
    stars: repo.stargazers_count ?? 0,
    archived: !!repo.archived,
    ...(release ? { latestVersion: release.tag_name ?? "", latestReleaseAt: time(release.published_at) } : {}),
  };
}

async function checkNpm(ref: { name: string }): Promise<Omit<ProjectActivity, "checkedAt">> {
  const name = ref.name.replace("/", "%2F");
  // The abbreviated document is much smaller than the full one.
  const doc = (await getJson(`https://registry.npmjs.org/${name}`, {
    Accept: "application/vnd.npm.install-v1+json",
  })) as { modified?: string; "dist-tags"?: { latest?: string }; versions?: Record<string, { deprecated?: string }> };
  const latest = doc["dist-tags"]?.latest;
  const downloads = (await getJson(`https://api.npmjs.org/downloads/point/last-week/${ref.name}`, {}).catch(
    () => null,
  )) as { downloads?: number } | null;
  return {
    source: "npm",
    lastActivityAt: time(doc.modified),
    latestVersion: latest ?? "",
    deprecated: !!(latest && doc.versions?.[latest]?.deprecated),
    ...(downloads?.downloads !== undefined ? { weeklyDownloads: downloads.downloads } : {}),
  };
}

/** The settings-page token, else the GITHUB_TOKEN secret. */
export async function githubToken(env: Pick<Env, "DB" | "GITHUB_TOKEN">): Promise<string | undefined> {
  return (await getGithubToken(env.DB)) ?? env.GITHUB_TOKEN;
}

export async function checkProject(ref: ProjectRef, token?: string): Promise<ProjectActivity> {
  const checked = ref.source === "github" ? await checkGithub(ref, token) : await checkNpm(ref);
  return { ...checked, checkedAt: Date.now() };
}

export function parseActivity(raw: string): ProjectActivity | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProjectActivity;
  } catch {
    return null;
  }
}

/**
 * Checks one bookmark and stores the result. On failure the previous data
 * stays, with the error noted. Returns null for URLs that aren't projects.
 */
export async function refreshActivity(env: Env, id: number, url: string): Promise<ProjectActivity | null> {
  const ref = parseProjectUrl(url);
  if (!ref) return null;
  const row = await env.DB.prepare("SELECT activity FROM items WHERE id = ?").bind(id).first<{ activity: string }>();
  const previous = parseActivity(row?.activity ?? "");
  let activity: ProjectActivity;
  try {
    activity = await checkProject(ref, ref.source === "github" ? await githubToken(env) : undefined);
  } catch (e) {
    const error = e instanceof CheckError ? e.message : "unreachable";
    activity = { ...(previous ?? { source: ref.source, lastActivityAt: null }), checkedAt: Date.now(), error };
  }
  await env.DB.prepare("UPDATE items SET activity = ?, activity_at = ? WHERE id = ?")
    .bind(JSON.stringify(activity), activity.checkedAt, id)
    .run();
  return activity;
}

export interface GithubTokenStatus {
  limit: number;
  remaining: number;
  /** When the hourly quota resets. */
  resetAt: number;
  /** When the token itself expires; null for tokens without an expiry. */
  expiresAt: number | null;
}

/**
 * Asks GitHub about a token: its hourly quota and, from the response header
 * GitHub adds for personal access tokens, when it expires. The rate_limit
 * endpoint doesn't count against the quota. Null when GitHub rejects it.
 */
export async function githubTokenStatus(token: string): Promise<GithubTokenStatus | null> {
  const res = await fetch("https://api.github.com/rate_limit", {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "PickIt", Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const { resources } = (await res.json()) as {
    resources?: { core?: { limit: number; remaining: number; reset: number } };
  };
  if (!resources?.core) return null;
  // e.g. "2026-12-01 00:00:00 UTC"; absent when the token never expires.
  const expiry = res.headers.get("github-authentication-token-expiration");
  const expiresAt = expiry ? Date.parse(expiry.replace(" UTC", "Z").replace(" ", "T")) : NaN;
  return {
    limit: resources.core.limit,
    remaining: resources.core.remaining,
    resetAt: resources.core.reset * 1000,
    expiresAt: Number.isNaN(expiresAt) ? null : expiresAt,
  };
}

/** Checks a few project bookmarks never checked, or not in the last week. */
export async function backfillActivity(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT id, url FROM items
     WHERE deleted_at IS NULL
       AND (url LIKE '%github.com/%' OR url LIKE '%npmjs.com/package/%')
       AND (activity_at IS NULL OR activity_at < ?)
     ORDER BY activity_at IS NOT NULL, activity_at, id DESC LIMIT ?`,
  )
    .bind(Date.now() - RECHECK_MS, BACKFILL_BATCH * 4)
    .all<{ id: number; url: string }>();
  // The LIKE is loose; keep the real projects, and mark the rest checked so they don't come back.
  const projects = results.filter((r) => parseProjectUrl(r.url)).slice(0, BACKFILL_BATCH);
  const others = results.filter((r) => !parseProjectUrl(r.url));
  if (others.length) {
    await env.DB.batch(
      others.map((r) => env.DB.prepare("UPDATE items SET activity_at = ? WHERE id = ?").bind(Date.now(), r.id)),
    );
  }
  await Promise.all(projects.map((r) => refreshActivity(env, r.id, r.url).catch(() => {})));
  return projects.length;
}
