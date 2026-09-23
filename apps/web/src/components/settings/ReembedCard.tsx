import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "#components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "#components/ui/select";
import { JobProgress, JobProgressSkeleton, JobActions, useJob } from "#components/settings/JobProgress";

type Mode = "missing" | "all";

const MODE_LABELS: Record<Mode, string> = {
  missing: "只补缺失或模型不一致的",
  all: "全部重建",
};

export function ReembedCard() {
  const [mode, setMode] = useState<Mode>("missing");
  const { job, error, run } = useJob("reembed");
  const running = job?.status === "running";

  return (
    <Card>
      <CardHeader>
        <CardTitle>向量索引重建</CardTitle>
        <CardDescription>
          为收藏生成向量索引。换了向量模型后，旧索引无法和新模型比较，需要重新生成。
        </CardDescription>
      </CardHeader>
      {!job && !error ? (
        <CardContent>
          <JobProgressSkeleton />
        </CardContent>
      ) : (
        job &&
        job.status !== "idle" && (
          <CardContent className="animate-fade-in">
            <JobProgress job={job} />
          </CardContent>
        )
      )}
      <CardFooter className="flex flex-wrap items-center gap-2">
        <Select
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          items={MODE_LABELS}
          disabled={running}
        >
          <SelectTrigger size="lg" className="w-auto min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
              <SelectItem key={m} value={m}>
                {MODE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <JobActions job={job} startLabel="开始重建" onStart={() => run("start", { mode })} run={run} />
        {error && <span className="text-destructive text-sm">{error}</span>}
      </CardFooter>
    </Card>
  );
}
