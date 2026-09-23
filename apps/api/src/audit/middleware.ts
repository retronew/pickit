import type { Context, Next } from "hono";
import type { Env } from "#types";
import { safeAudit, requestMeta } from "./store";
import { sanitize } from "./sanitize";
import { describe, type Body } from "./describe";

// The actor is set by the auth middleware and read back after the handler.
const actors = new WeakMap<Request, string>();

export function setActor(c: Context, actor: string) {
  actors.set(c.req.raw, actor);
}

/** Requests that are audited: every write, plus data export. */
function isAudited(method: string, path: string): boolean {
  if (path.startsWith("/api/auth/")) return path === "/api/auth/sign-out";
  // Driven automatically every few seconds while a job page is open.
  if (/^\/api\/jobs\/\w+\/step$/.test(path)) return false;
  // Reads aren't audited, except the ones that take data out.
  if (method === "GET") return path === "/api/items/export" || /^\/api\/backups\/[^/]+$/.test(path);
  return method !== "OPTIONS" && method !== "HEAD";
}

async function readBody(c: Context): Promise<Body> {
  if (!c.req.header("content-type")?.includes("application/json")) return {};
  try {
    // Hono caches the parsed body, so the handler can still read it.
    const body = await c.req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

async function itemName(db: D1Database, path: string): Promise<string | undefined> {
  const m = path.match(/^\/api\/items\/(\d+)(?:\/\w+)?$/);
  if (!m) return undefined;
  const row = await db
    .prepare("SELECT name FROM items WHERE id = ?")
    .bind(Number(m[1]))
    .first<{ name: string }>()
    .catch(() => null);
  return row?.name;
}

async function responseJson(res: Response): Promise<Body> {
  if (!res.headers.get("content-type")?.includes("application/json")) return {};
  try {
    const data = await res.clone().json();
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Body) : {};
  } catch {
    return {};
  }
}

type SessionLookup = (c: Context<{ Bindings: Env }>) => Promise<string | null>;

/**
 * Hono middleware. Mount before the auth middleware so it also records
 * rejected (401) writes. `sessionActor` resolves the signed-in email for
 * routes the auth middleware skips (sign-out).
 */
export function auditMiddleware(sessionActor: SessionLookup) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const path = new URL(c.req.url).pathname;
    const method = c.req.method;
    if (!isAudited(method, path)) return next();

    const started = Date.now();
    const body = await readBody(c);
    const name = await itemName(c.env.DB, path);
    const preActor = path === "/api/auth/sign-out" ? await sessionActor(c) : null;

    await next();

    const task = (async () => {
      const res = await responseJson(c.res);
      const described = describe(method, path, body, name, res);
      if (described === false) return; // deliberately not audited
      const d = described ?? { action: "other", summary: `${method} ${path}` };
      const actor = preActor ?? actors.get(c.req.raw) ?? "匿名";
      const status = c.res.status;
      const error = status >= 400 && typeof res.error === "string" ? res.error : undefined;
      await safeAudit(c.env.DB, {
        actor,
        action: d.action,
        target: d.target,
        summary: d.summary,
        status,
        ...requestMeta(c.req.raw),
        detail: {
          method,
          path,
          durationMs: Date.now() - started,
          ...(Object.keys(body).length ? { body: sanitize(body) } : {}),
          ...(error ? { error } : {}),
        },
      });
    })();
    try {
      c.executionCtx.waitUntil(task);
    } catch {
      await task; // no execution context (tests)
    }
  };
}
