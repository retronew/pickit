import { betterAuth } from "better-auth";
import type { Env } from "#types";

// pickit is single-user: sign-in goes through Google / GitHub via Better Auth,
// and only emails listed in ALLOWED_EMAILS may get a session. Without the
// allowlist anyone with a Google or GitHub account could sign in.

export type SocialProvider = "google" | "github";

/** Lower-cased emails from ALLOWED_EMAILS (comma or whitespace separated). */
export function allowedEmails(env: Env): Set<string> {
  return new Set(
    (env.ALLOWED_EMAILS ?? "")
      .split(/[\s,]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAllowedEmail(env: Env, email: string | null | undefined): boolean {
  return !!email && allowedEmails(env).has(email.toLowerCase());
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
      validateUserInfo: ({ user }) => {
        if (!isAllowedEmail(env, user.email)) {
          return {
            error: "email_not_allowed",
            errorDescription: "这个账号没有访问权限",
          };
        }
      },
    },
    account: {
      // Google and GitHub with the same email sign in as the same user.
      accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
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
