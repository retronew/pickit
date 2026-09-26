import { useState } from "react";
import { Confirm } from "#components/Confirm";
import { api, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

/** Schedules every bookmark's page text to be captured again (after confirming); the backfill works through them. */
export function useRecaptureAll(onDone?: () => void) {
  const [busy, setBusy] = useState(false);

  async function recaptureAll() {
    const ok = await Confirm.call({
      title: m.content_recapture_all_title(),
      message: m.content_recapture_all_message(),
      confirmLabel: m.content_recapture_all(),
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { scheduled } = await api<{ scheduled: number }>("/api/items/content/recapture-all", { method: "POST" });
      toastSuccess(m.content_recapture_all_done({ count: scheduled }), { id: "content-recapture" });
      onDone?.();
    } catch (err) {
      toastError(m.content_recapture_all_failed(), err, { id: "content-recapture" });
    } finally {
      setBusy(false);
    }
  }

  return { busy, recaptureAll };
}
