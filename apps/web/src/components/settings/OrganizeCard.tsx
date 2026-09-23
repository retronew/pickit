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
import { JobProgress, JobActions, useJob } from "#components/settings/JobProgress";

type Mode = "missing" | "all";

const MODE_LABELS: Record<Mode, string> = {
  missing: "只补缺分类和标签的",
  all: "全部重新整理",
};

export function OrganizeCard() {
  const [mode, setMode] = useState<Mode>("missing");
  const { job, error, run } = useJob("organize");
  const running = job?.status === "running";

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 批量整理</CardTitle>
        <CardDescription>
          让 AI 重新给收藏分类、打标签，尽量沿用已有分类。
        </CardDescription>
      </CardHeader>
      {job && job.status !== "idle" && (
        <CardContent className="animate-fade-in">
          <JobProgress job={job} />
        </CardContent>
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
        <JobActions job={job} startLabel="开始整理" onStart={() => run("start", { mode })} run={run} />
        {error && <span className="text-destructive text-sm">{error}</span>}
      </CardFooter>
    </Card>
  );
}
