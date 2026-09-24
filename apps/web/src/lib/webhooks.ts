import { m } from "#lib/i18n";

export const WEBHOOK_EVENTS = ["item.created", "item.updated", "item.deleted", "job.finished"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface Webhook {
  id: number;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  createdAt: number;
  lastAt: number | null;
  /** HTTP status of the latest delivery; null when it never reached the endpoint. */
  lastStatus: number | null;
  lastError: string | null;
}

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, () => string> = {
  "item.created": m.webhook_event_item_created,
  "item.updated": m.webhook_event_item_updated,
  "item.deleted": m.webhook_event_item_deleted,
  "job.finished": m.webhook_event_job_finished,
};

/** Whether the latest delivery went through; null before the first one. */
export const lastDeliveryOk = (w: Webhook) => (w.lastAt === null ? null : w.lastError === null);
