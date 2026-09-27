import { useQuery } from "@tanstack/react-query";
import { Confirm } from "#components/Confirm";
import { Prompt } from "#components/Prompt";
import { ShareDialog } from "#components/shares/ShareDialog";
import { ShareAccessDialog } from "#components/shares/ShareAccessDialog";
import { CollectionOrderDialog } from "#components/shares/CollectionOrderDialog";
import { api, toastError, toastSuccess } from "#lib/api";
import type { Share } from "#lib/shares";
import { m } from "#lib/i18n";
import { sharesQuery } from "#lib/queries";
import { useRefresh } from "#hooks/useRefresh";

/** The shares list on the shares page and the actions on it. */
export function useShares() {
  const { data, isError } = useQuery(sharesQuery);
  const shares = data ?? (isError ? [] : null);
  const refresh = useRefresh(sharesQuery.queryKey);

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

  async function reorderCollection(s: Share) {
    if (await CollectionOrderDialog.call({ share: s })) refresh();
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

  return { shares, refresh, create, rename, editAccess, reorderCollection, remove };
}
