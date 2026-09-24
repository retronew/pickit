import type { Context, Next } from "hono";
import type { Env } from "#types";
import { DEV_USER, getAuth, isAllowedEmail, isDevBypass } from "#auth";
import { getApiToken } from "#settings";
import { setActor } from "#audit/index";

const PUBLIC_PATHS = new Set(["/api/health"]);

/** Requires a Better Auth session (allowed email) or the API token. */
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PATHS.has(path) || path.startsWith("/api/public/") || path.startsWith("/api/auth/")) {
    await next();
    return;
  }
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const stored = await getApiToken(c.env.DB);
    if (stored && token === stored) {
      setActor(c, "API Token");
      await next();
      return;
    }
  }
  if (isDevBypass(c.env)) {
    setActor(c, DEV_USER.email);
    await next();
    return;
  }
  const session = await getAuth(c.env)
    .api.getSession({ headers: c.req.raw.headers })
    .catch(() => null);
  // Re-check the allowlist so removing an email revokes existing sessions.
  if (!session || !(await isAllowedEmail(c.env, session.user.email))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  setActor(c, session.user.email);
  await next();
}
