import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";
import { backupsQuery } from "#lib/queries";
import { useRefresh } from "#hooks/useRefresh";

export type BackupKind = "daily" | "manual" | "pre-restore";
export type RestoreMode = "merge" | "replace";

export interface BackupInfo {
  name: string;
  size: number;
  uploaded: number;
  count: number | null;
  kind: BackupKind;
}

export interface RestoreResult {
  mode: RestoreMode;
  total: number;
  inserted: number;
  skipped: number;
  trashed: number;
  snapshot: string | null;
}

export function restoreBackup(name: string, mode: RestoreMode, dryRun: boolean) {
  return api<RestoreResult>(`/api/backups/${encodeURIComponent(name)}/restore`, {
    json: { mode, dryRun },
  });
}

/** R2 backups: list, back up now, delete. */
export function useBackups() {
  const { data, error: loadError } = useQuery(backupsQuery);
  const backups = data?.backups ?? (loadError ? [] : null);
  const configured = data?.configured ?? true;
  const error = loadError ? errorMessage(loadError) : "";
  const [creating, setCreating] = useState(false);
  const reload = useRefresh(backupsQuery.queryKey);

  async function create() {
    setCreating(true);
    try {
      const b = await api<BackupInfo>("/api/backups", { method: "POST" });
      toastSuccess(m.backup_done(), { description: m.items_total({ count: b.count ?? 0 }), id: "backup" });
      await reload();
    } catch (err) {
      toastError(m.backup_failed(), err, { id: "backup" });
    } finally {
      setCreating(false);
    }
  }

  async function remove(name: string) {
    try {
      await api(`/api/backups/${encodeURIComponent(name)}`, { method: "DELETE" });
      toastSuccess(m.backup_deleted(), { description: name, id: "backup" });
      await reload();
    } catch (err) {
      toastError(m.backup_delete_failed(), err, { id: "backup" });
    }
  }

  return { backups, configured, error, creating, reload, create, remove };
}
