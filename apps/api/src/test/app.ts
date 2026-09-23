import app from "../index";
import type { Env } from "#types";
import { createTestD1, type TestD1 } from "./d1";

export const TEST_TOKEN = "test-token-0123456789abcdef";

/**
 * The real Worker (routes, auth and audit middleware) on a fresh database.
 * Requests authenticate with the API token unless `auth: false`; work queued
 * with waitUntil (audit writes) is awaited before the response is returned.
 */
export async function createTestApp(envOverrides: Partial<Env> = {}) {
  const db = createTestD1();
  await db.prepare("INSERT INTO settings (key, value) VALUES ('api_token', ?)").bind(TEST_TOKEN).run();
  const env = {
    DB: db as unknown as D1Database,
    ASSETS: { fetch: async () => new Response("asset") } as unknown as Fetcher,
    BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
    BETTER_AUTH_URL: "http://localhost",
    ALLOWED_EMAILS: "owner@example.com",
    ...envOverrides,
  } as Env;

  async function request(
    path: string,
    init: { method?: string; json?: unknown; auth?: boolean | string; headers?: Record<string, string> } = {},
  ) {
    const headers: Record<string, string> = { ...init.headers };
    if (init.auth !== false) headers.Authorization = `Bearer ${typeof init.auth === "string" ? init.auth : TEST_TOKEN}`;
    if (init.json !== undefined) headers["Content-Type"] = "application/json";
    const pending: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => pending.push(p),
      passThroughOnException: () => {},
      props: {},
    } as unknown as ExecutionContext;
    const res = await app.fetch(
      new Request(`http://localhost${path}`, {
        method: init.method ?? (init.json === undefined ? "GET" : "POST"),
        headers,
        body: init.json === undefined ? undefined : JSON.stringify(init.json),
      }),
      env,
      ctx,
    );
    await Promise.all(pending);
    return res;
  }

  /** request() + JSON body, failing loudly on an unexpected status. */
  async function json<T = any>(path: string, init: Parameters<typeof request>[1] = {}, status = 200): Promise<T> {
    const res = await request(path, init);
    const body = await res.text();
    if (res.status !== status) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${body}`);
    return (body ? JSON.parse(body) : null) as T;
  }

  return { db: db as TestD1, env, request, json };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
