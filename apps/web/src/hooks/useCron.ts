import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CronRun, CronTaskId } from "@pickit/shared";
import { api, toastError, toastSuccess } from "#lib/api";
import { CRON_TASK_LABELS } from "#lib/cron";
import { m } from "#lib/i18n";
import { cronQuery } from "#lib/queries";
import { useRefresh } from "#hooks/useRefresh";

/** Polled this often while live refresh is on. */
const LIVE_INTERVAL_MS = 10_000;

/** Scheduled tasks, their runs and "Run now"; polls while `live` is on. */
export function useCron(live: boolean) {
  const { data, dataUpdatedAt } = useQuery({
    ...cronQuery,
    refetchInterval: live ? LIVE_INTERVAL_MS : false,
    meta: { errorToast: { title: m.cron_load_failed, id: "cron" } },
  });
  const [running, setRunning] = useState<CronTaskId | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useRefresh(cronQuery.queryKey);

  /** "Refresh" button: same as the poll, with a spinner. */
  async function reload() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

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

  return { overview: data ?? null, running, refreshing, updatedAt: dataUpdatedAt || null, reload, runNow };
}
