export interface JobState {
  total: number;
  done: number;
  failedIds: number[];
  running: boolean;
  finishedAt?: number;
}

export function JobProgress({
  job,
  doneLabel,
}: {
  job: JobState;
  doneLabel: string;
}) {
  if (job.total === 0) return null;
  const processed = job.done + job.failedIds.length;
  const pct = Math.round((processed / job.total) * 100);
  return (
    <div className="space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-muted-foreground text-sm">
        {job.running
          ? `处理中… ${processed}/${job.total}`
          : `${doneLabel}：${job.done}/${job.total} 成功`}
        {job.failedIds.length > 0 && `，失败 ${job.failedIds.length} 条`}
      </p>
    </div>
  );
}
