import { useCallback, useEffect, useState } from "react";
import { Confirm } from "#components/Confirm";
import { Prompt } from "#components/Prompt";
import { ShareDialog } from "#components/shares/ShareDialog";
import { ShareAccessDialog } from "#components/shares/ShareAccessDialog";
import { api, toastError, toastSuccess } from "#lib/api";
import type { Share } from "#lib/shares";
import { m } from "#lib/i18n";

/** The shares list on the shares page and the actions on it. */
export function useShares() {
  const [shares, setShares] = useState<Share[] | null>(null);

  const refresh = useCallback(
    () =>
      api<Share[]>("/api/shares")
        .then(setShares)
        .catch(() => setShares((prev) => prev ?? [])),
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function create() {
    if (await ShareDialog.call({})) refresh();
  }

  async function rename(s: Share) {
    const title = await Prompt.call({
      title: m.shares_rename_title(),
      defaultValue: s.title,
      confirmLabel: m.common_save(),
    });
    if (!title || title === s.title) return;
    try {
      await api(`/api/shares/${s.slug}`, { method: "PATCH", json: { title } });
      toastSuccess(m.shares_renamed(), { id: "share" });
      refresh();
    } catch (err) {
      toastError(m.shares_rename_failed(), err, { id: "share" });
    }
  }

  async function editAccess(s: Share) {
    if (await ShareAccessDialog.call({ share: s })) refresh();
  }

  async function remove(s: Share) {
    const ok = await Confirm.call({
      title: m.shares_revoke_title({ title: s.title || s.value }),
      message: m.shares_revoke_message(),
      confirmLabel: m.shares_revoke(),
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/shares/${s.slug}`, { method: "DELETE" });
      toastSuccess(m.share_revoked(), { id: "share" });
    } catch (err) {
      toastError(m.share_revoke_failed(), err, { id: "share" });
    }
    refresh();
  }

  return { shares, refresh, create, rename, editAccess, remove };
}
