import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "#components/ui/button";

export type JobKind = "reembed" | "organize";

export interface JobFailure {
  id: number;
  name: string;
  error: string;
}

export interface JobView {
  kind: JobKind;
  status: "idle" | "running" | "paused" | "done";
  mode: string;
  total: number;
  done: number;
  pending: number;
  failures: JobFailure[];
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
  lastError?: string;
  /** Another driver (the per-minute cron) is processing a batch right now. */
  stepping: boolean;
}

async function call(kind: JobKind, action: string, body?: unknown) {
  const res = await fetch(`/api/jobs/${kind}/${action}`, {
    method: action === "status" ? "GET" : "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "操作失败，请稍后重试");
  return data as JobView;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Loads a job and, while it is running, drives it by calling /step back to
 * back. Leaving the page just stops driving; the server cron keeps going.
 */
export function useJob(kind: JobKind) {
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const driving = useRef(false);

  const drive = useCallback(async () => {
    if (driving.current) return;
    driving.current = true;
    try {
      while (alive.current) {
        const next = await call(kind, "step");
        if (!alive.current) break;
        setJob(next);
        if (next.status !== "running") break;
        // The cron holds the lock for this batch; check back shortly.
        if (next.stepping) await sleep(2000);
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      driving.current = false;
    }
  }, [kind]);

  useEffect(() => {
    alive.current = true;
    call(kind, "status")
      .then((j) => {
        setJob(j);
        if (j.status === "running") drive();
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      alive.current = false;
    };
  }, [kind, drive]);

  const run = useCallback(
    async (action: "start" | "pause" | "resume" | "retry", body?: unknown) => {
      setError("");
      try {
        const next = await call(kind, action, body);
        setJob(next);
        if (next.status === "running") drive();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [kind, drive],
  );

  return { job, error, run };
}

function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} 分 ${s % 60} 秒` : `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}

const STATUS_LABEL: Record<JobView["status"], string> = {
  idle: "未开始",
  running: "进行中",
  paused: "已暂停",
  done: "已完成",
};

/** Progress, status and per-item failure details of a job. */
export function JobProgress({ job }: { job: JobView }) {
  if (job.status === "idle" || job.total === 0) {
    return job.status === "done" ? (
      <p className="text-muted-foreground text-sm">没有需要处理的收藏。</p>
    ) : null;
  }
  const failed = job.failures.length;
  const processed = job.total - job.pending;
  const pct = Math.round((processed / job.total) * 100);
  const end = job.status === "running" ? Date.now() : (job.finishedAt ?? job.updatedAt);
  return (
    <div className="space-y-2">
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div className="bg-primary h-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-muted-foreground text-sm tabular-nums">
        {STATUS_LABEL[job.status]} · {processed}/{job.total}（{pct}%）· 成功 {job.done}
        {failed > 0 && ` · 失败 ${failed}`}
        {job.startedAt > 0 && ` · 用时 ${formatDuration(end - job.startedAt)}`}
      </p>
      {job.status === "running" && (
        <p className="text-muted-foreground text-xs">
          离开这个页面后，任务会在后台每分钟继续推进。
        </p>
      )}
      {job.lastError && job.status === "paused" && (
        <p className="text-destructive text-sm break-all">已自动暂停：{job.lastError}</p>
      )}
      {failed > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer select-none">
            查看失败详情（{failed} 条）
          </summary>
          <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
            {job.failures.map((f) => (
              <li key={f.id} className="bg-muted/50 rounded-md px-3 py-2">
                <p className="font-medium">{f.name}</p>
                <p className="text-destructive text-xs break-all">{f.error}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Start / pause / resume / retry buttons matching the job's state. */
export function JobActions({
  job,
  startLabel,
  onStart,
  run,
}: {
  job: JobView | null;
  startLabel: string;
  onStart: () => void;
  run: (action: "pause" | "resume" | "retry") => void;
}) {
  const status = job?.status ?? "idle";
  return (
    <>
      {status === "running" ? (
        <Button size="lg" variant="outline" onClick={() => run("pause")}>
          暂停
        </Button>
      ) : (
        <>
          {status === "paused" && (
            <Button size="lg" onClick={() => run("resume")}>
              继续
            </Button>
          )}
          <Button size="lg" variant={status === "paused" ? "outline" : "default"} onClick={onStart}>
            {status === "paused" ? "重新开始" : startLabel}
          </Button>
          {!!job?.failures.length && (
            <Button size="lg" variant="outline" onClick={() => run("retry")}>
              重试失败项
            </Button>
          )}
        </>
      )}
    </>
  );
}
