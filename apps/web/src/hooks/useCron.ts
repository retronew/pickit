import { useCallback, useEffect, useState } from "react";
import type { CronOverview, CronRun, CronTaskId } from "@pickit/shared";
import { api, toastError, toastSuccess } from "#lib/api";
import { CRON_TASK_LABELS } from "#lib/cron";
import { m } from "#lib/i18n";

/** Refreshed this often while the tab is open: next runs and new logs move on their own. */
const POLL_MS = 30_000;

/** Scheduled tasks, their runs, and "Run now". */
export function useCron() {
  const [overview, setOverview] = useState<CronOverview | null>(null);
  const [running, setRunning] = useState<CronTaskId | null>(null);

  const refresh = useCallback(async () => {
    try {
      setOverview(await api<CronOverview>("/api/cron"));
    } catch (err) {
      toastError(m.cron_load_failed(), err, { id: "cron" });
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

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

  return { overview, running, runNow };
}
