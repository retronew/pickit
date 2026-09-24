import { useCallback, useEffect, useState } from "react";
import type { CronOverview, CronRun, CronTaskId } from "@pickit/shared";
import { api, toastError, toastSuccess } from "#lib/api";
import { CRON_TASK_LABELS } from "#lib/cron";
import { m } from "#lib/i18n";

/** Polled this often while live refresh is on. */
const LIVE_INTERVAL_MS = 10_000;

/** Scheduled tasks, their runs and "Run now"; polls while `live` is on. */
export function useCron(live: boolean) {
  const [overview, setOverview] = useState<CronOverview | null>(null);
  const [running, setRunning] = useState<CronTaskId | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setOverview(await api<CronOverview>("/api/cron"));
      setUpdatedAt(Date.now());
    } catch (err) {
      toastError(m.cron_load_failed(), err, { id: "cron" });
    }
  }, []);

  /** "Refresh" button: same as the poll, with a spinner. */
  async function reload() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(refresh, LIVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [live, refresh]);

  async function runNow(task: CronTaskId) {
    setRunning(task);
    try {
      const run = await api<CronRun>(`/api/cron/${task}/run`, { method: "POST" });
      if (run.status === "error") toastError(m.cron_run_failed(), new Error(run.error ?? ""), { id: "cron" });
      else toastSuccess(m.cron_run_done({ task: CRON_TASK_LABELS[task].name() }), { id: "cron" });
    } catch (err) {
      toastError(m.cron_run_failed(), err, { id: "cron" });
    } finally {
      setRunning(null);
      refresh();
    }
  }

  return { overview, running, refreshing, updatedAt, reload, runNow };
}
