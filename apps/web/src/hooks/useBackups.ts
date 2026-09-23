import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

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
  const [backups, setBackups] = useState<BackupInfo[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    try {
      const data = await api<{ configured: boolean; backups: BackupInfo[] }>("/api/backups");
      setConfigured(data.configured);
      setBackups(data.backups);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
      setBackups((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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
