import { useCallback, useEffect, useState } from "react";
import { Confirm } from "#components/Confirm";
import { WebhookDialog } from "#components/settings/webhooks/WebhookDialog";
import { api, toastError, toastSuccess } from "#lib/api";
import type { Webhook } from "#lib/webhooks";
import { m } from "#lib/i18n";

/** The webhooks on the settings page and the actions on them. */
export function useWebhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null);
  /** The secret of a webhook just created: shown once, until dismissed. */
  const [newSecret, setNewSecret] = useState<{ id: number; secret: string } | null>(null);

  const refresh = useCallback(
    () =>
      api<Webhook[]>("/api/webhooks")
        .then(setWebhooks)
        .catch(() => setWebhooks((prev) => prev ?? [])),
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function add() {
    const input = await WebhookDialog.call({});
    if (!input) return;
    try {
      const created = await api<Webhook & { secret: string }>("/api/webhooks", { json: input });
      setNewSecret({ id: created.id, secret: created.secret });
      toastSuccess(m.webhook_added(), { id: "webhook" });
    } catch (err) {
      toastError(m.webhook_save_failed(), err, { id: "webhook" });
    }
    refresh();
  }

  async function update(w: Webhook, patch: Partial<Pick<Webhook, "url" | "events" | "enabled">>) {
    try {
      await api(`/api/webhooks/${w.id}`, { method: "PATCH", json: patch });
    } catch (err) {
      toastError(m.webhook_save_failed(), err, { id: "webhook" });
    }
    refresh();
  }

  async function edit(w: Webhook) {
    const input = await WebhookDialog.call({ webhook: w });
    if (input) await update(w, input);
  }

  async function test(w: Webhook) {
    try {
      const res = await api<{ ok: boolean; status: number | null; error: string | null }>(
        `/api/webhooks/${w.id}/test`,
        { method: "POST" },
      );
      if (res.ok) toastSuccess(m.webhook_test_ok({ status: res.status ?? 0 }), { id: "webhook" });
      else toastError(m.webhook_test_failed(), new Error(res.error ?? String(res.status)), { id: "webhook" });
    } catch (err) {
      toastError(m.webhook_test_failed(), err, { id: "webhook" });
    }
    refresh();
  }

  async function remove(w: Webhook) {
    const ok = await Confirm.call({
      title: m.webhook_delete_title(),
      message: w.url,
      confirmLabel: m.action_delete(),
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/webhooks/${w.id}`, { method: "DELETE" });
      if (newSecret?.id === w.id) setNewSecret(null);
    } catch (err) {
      toastError(m.webhook_delete_failed(), err, { id: "webhook" });
    }
    refresh();
  }

  return {
    webhooks,
    newSecret,
    dismissSecret: () => setNewSecret(null),
    add,
    edit,
    test,
    remove,
    setEnabled: (w: Webhook, enabled: boolean) => update(w, { enabled }),
  };
}
