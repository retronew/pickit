// Project activity of GitHub repositories and npm packages: which bookmark
// URLs are projects, what is stored about them, and how active they look.

export type ProjectRef = { source: "github"; owner: string; repo: string } | { source: "npm"; name: string };

export interface ProjectActivity {
  source: "github" | "npm";
  /** When PickIt last asked the source. */
  checkedAt: number;
  /** Latest push (GitHub) or registry change (npm); null when unknown. */
  lastActivityAt: number | null;
  stars?: number;
  archived?: boolean;
  /** npm: the latest version is marked deprecated. */
  deprecated?: boolean;
  latestVersion?: string;
  latestReleaseAt?: number | null;
  weeklyDownloads?: number;
  /** Why the latest check failed ("not_found", "rate_limited", …); data above may be older. */
  error?: string;
}

export type ActivityLevel = "active" | "slowing" | "stale" | "archived";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Up to this long since the last activity: active. */
export const ACTIVE_DAYS = 90;
/** Beyond this: stale (in between: slowing). */
export const STALE_DAYS = 365;

/** GitHub paths that aren't repositories. */
const GITHUB_RESERVED = new Set([
  "orgs", "users", "topics", "features", "settings", "marketplace", "sponsors", "explore",
  "collections", "trending", "search", "notifications", "about", "pricing", "login", "apps", "enterprise",
]);

/** The GitHub repository or npm package a URL points at, or null. */
export function parseProjectUrl(raw: string): ProjectRef | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (host === "github.com" && parts.length >= 2 && !GITHUB_RESERVED.has(parts[0].toLowerCase())) {
    return { source: "github", owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  }
  if (host === "npmjs.com" && parts[0] === "package" && parts[1]) {
    const name = parts[1].startsWith("@") && parts[2] ? `${parts[1]}/${parts[2]}` : parts[1];
    return { source: "npm", name };
  }
  return null;
}

/** How active a project looks; null when there's nothing to go on. */
export function activityLevel(a: ProjectActivity | null, now = Date.now()): ActivityLevel | null {
  if (!a) return null;
  if (a.archived || a.deprecated) return "archived";
  if (a.lastActivityAt === null) return null;
  const days = (now - a.lastActivityAt) / DAY_MS;
  return days <= ACTIVE_DAYS ? "active" : days <= STALE_DAYS ? "slowing" : "stale";
}
