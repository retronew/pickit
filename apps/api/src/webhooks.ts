// Outgoing webhooks. Each delivery is a POST of
//   { "event": "item.created", "at": 1727170000000, "data": { … } }
// with headers X-PickIt-Event and X-PickIt-Signature: sha256=<hex HMAC of the
// raw body with the webhook's secret>. Deliveries run in the background
// (waitUntil), time out after TIMEOUT_MS, are not retried, and record their
// outcome on the webhook row.

import type { Env } from "#types";

export const WEBHOOK_EVENTS = ["item.created", "item.updated", "item.deleted", "job.finished"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
/** Sent only by "Send test"; any webhook receives it. */
export type DeliveryEvent = WebhookEvent | "ping";

const TIMEOUT_MS = 10_000;
const URL_MAX = 2000;

export interface WebhookRow {
  id: number;
  url: string;
  events: string;
  secret: string;
  enabled: number;
  created_at: number;
  last_at: number | null;
  last_status: number | null;
  last_error: string | null;
}

/** A webhook as the settings page sees it: never the secret. */
export function webhookView(r: WebhookRow) {
  return {
    id: r.id,
    url: r.url,
    events: parseEvents(r.events),
    enabled: !!r.enabled,
    createdAt: r.created_at,
    lastAt: r.last_at,
    lastStatus: r.last_status,
    lastError: r.last_error,
  };
}

export function parseEvents(raw: unknown): WebhookEvent[] {
  let list = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(list) ? WEBHOOK_EVENTS.filter((e) => list.includes(e)) : [];
}

/** An http(s) URL within the length limit; null otherwise. */
export function cleanUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > URL_MAX) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function newSecret(): string {
  return [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Sends one event to one webhook and records the outcome. Never throws. */
export async function deliver(db: D1Database, hook: WebhookRow, event: DeliveryEvent, data: unknown) {
  const body = JSON.stringify({ event, at: Date.now(), data });
  let status: number | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "PickIt-Webhook",
        "X-PickIt-Event": event,
        "X-PickIt-Signature": `sha256=${await sign(hook.secret, body)}`,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = res.status;
    if (!res.ok) error = (await res.text().catch(() => "")).slice(0, 200) || res.statusText;
  } catch (e) {
    error = String(e instanceof Error ? e.message : e).slice(0, 200);
  }
  await db
    .prepare("UPDATE webhooks SET last_at = ?, last_status = ?, last_error = ? WHERE id = ?")
    .bind(Date.now(), status, error, hook.id)
    .run()
    .catch(() => {});
  return { status, error };
}

/** Delivers an event to every enabled webhook subscribed to it. */
export async function dispatchEvent(env: Pick<Env, "DB">, event: WebhookEvent, data: unknown) {
  const { results } = await env.DB.prepare("SELECT * FROM webhooks WHERE enabled = 1").all<WebhookRow>();
  const hooks = results.filter((h) => parseEvents(h.events).includes(event));
  await Promise.all(hooks.map((h) => deliver(env.DB, h, event, data)));
}

/** Fire-and-forget dispatch for request handlers. */
export function emitEvent(
  env: Pick<Env, "DB">,
  waitUntil: (p: Promise<unknown>) => void,
  event: WebhookEvent,
  data: unknown,
) {
  waitUntil(dispatchEvent(env, event, data).catch(() => {}));
}
