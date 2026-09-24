import { betterAuth } from "better-auth";
import type { Env } from "#types";
import { safeAudit, requestMeta } from "#audit/index";
import type { MessageRef } from "@pickit/shared/i18n";

const PROVIDER_NAMES: Record<string, string> = { google: "Google", github: "GitHub" };
const providerName = (id?: string): MessageRef | string =>
  id ? (PROVIDER_NAMES[id] ?? id) : { key: "audit_sum_unknown_provider" };

// PickIt is single-user: sign-in goes through Google / GitHub via Better Auth,
// and only emails listed in ALLOWED_EMAILS may get a session. Without the
// allowlist anyone with a Google or GitHub account could sign in.

export type SocialProvider = "google" | "github";

const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/** Lower-cased, de-duplicated emails from a comma or whitespace separated list. */
export function parseEmails(raw: string | null | undefined): string[] {
  return [
    ...new Set(
      (raw ?? "")
        .split(/[\s,]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/**
 * Owners come from the ALLOWED_EMAILS secret. They are always allowed and
 * can't be removed from the settings page, so nobody can lock themselves out.
 */
export function ownerEmails(env: Env): string[] {
  return parseEmails(env.ALLOWED_EMAILS);
}

const SETTINGS_KEY = "allowed_emails";

/** Extra emails managed on the settings page. */
export async function getExtraEmails(db: D1Database): Promise<string[]> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind(SETTINGS_KEY)
    .first<{ value: string }>();
  try {
    const list: unknown = row ? JSON.parse(row.value) : [];
    return Array.isArray(list) ? list.filter((e): e is string => typeof e === "string") : [];
  } catch {
    return [];
  }
}

export async function setExtraEmails(db: D1Database, emails: string[]) {
  await db
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .bind(SETTINGS_KEY, JSON.stringify(emails))
    .run();
}

/** Owners plus the extra emails from the settings page. */
export async function allowedEmails(env: Env): Promise<Set<string>> {
  return new Set([...ownerEmails(env), ...(await getExtraEmails(env.DB))]);
}

export async function isAllowedEmail(env: Env, email: string | null | undefined): Promise<boolean> {
  return !!email && (await allowedEmails(env)).has(email.toLowerCase());
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
export const DEV_USER = { name: "Local dev", email: "dev@localhost", image: null };

/**
 * DEV_AUTH_BYPASS=1 in .dev.vars lets local dev run without OAuth apps. It
 * also requires a localhost BETTER_AUTH_URL, so a stray production var can't
 * open the API. (The request URL can't tell: `wrangler dev` rewrites it to the
 * custom-domain route.)
 */
export function isDevBypass(env: Env): boolean {
  if (env.DEV_AUTH_BYPASS !== "1" || !env.BETTER_AUTH_URL) return false;
  try {
    return LOCAL_HOSTS.has(new URL(env.BETTER_AUTH_URL).hostname);
  } catch {
    return false;
  }
}

/** Providers whose client id and secret are both configured. */
export function enabledProviders(env: Env): SocialProvider[] {
  const out: SocialProvider[] = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) out.push("google");
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) out.push("github");
  return out;
}

export function createAuth(env: Env) {
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : [],
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              prompt: "select_account" as const,
            },
          }
        : {}),
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
        : {}),
    },
    user: {
      // Runs before creating a user, linking an account or signing in.
      validateUserInfo: async ({ user, source }, ctx) => {
        if (!(await isAllowedEmail(env, user.email))) {
          await safeAudit(env.DB, {
            actor: user.email ?? "unknown",
            action: "auth.sign_in_denied",
            summary: { key: "audit_sum_sign_in_denied", params: { provider: providerName(source.oauth?.providerId) } },
            status: 403,
            ...(ctx?.request ? requestMeta(ctx.request) : {}),
            detail: { provider: source.oauth?.providerId, action: source.action },
          });
          return {
            error: "email_not_allowed",
            errorDescription: "This account is not allowed to sign in",
          };
        }
      },
    },
    account: {
      // Google and GitHub with the same email sign in as the same user.
      accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
    },
    databaseHooks: {
      session: {
        create: {
          after: async (session, ctx) => {
            const user = await env.DB.prepare('SELECT email FROM "user" WHERE id = ?')
              .bind(session.userId)
              .first<{ email: string }>();
            const provider = (ctx?.params as { id?: string } | undefined)?.id;
            await safeAudit(env.DB, {
              actor: user?.email ?? session.userId,
              action: "auth.sign_in",
              summary: { key: "audit_sum_sign_in", params: { provider: providerName(provider) } },
              status: 200,
              ip: session.ipAddress ?? "",
              userAgent: session.userAgent ?? "",
              detail: { provider },
            });
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      // Signed cookie cache: most requests validate the session without D1.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

// One instance per isolate; env bindings are stable for its lifetime.
let cached: { env: Env; auth: Auth } | null = null;

export function getAuth(env: Env): Auth {
  if (cached?.env !== env) cached = { env, auth: createAuth(env) };
  return cached.auth;
}
