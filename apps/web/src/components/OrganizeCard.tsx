import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "#components/ui/card";
import { Button } from "#components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "#components/ui/select";
import { JobProgress, type JobState } from "#components/JobProgress";

type Mode = "missing" | "all";

const MODE_LABELS: Record<Mode, string> = {
  missing: "只补缺分类和标签的",
  all: "全部重新整理",
};

export function OrganizeCard() {
  const [mode, setMode] = useState<Mode>("missing");
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState("");

  const fetchStatus = () =>
    fetch("/api/items/organize-status")
      .then((r) => r.json())
      .then((d: JobState) => setJob(d));

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (!job?.running) return;
    const timer = setInterval(fetchStatus, 1200);
    return () => clearInterval(timer);
  }, [job?.running]);

  async function start() {
    setError("");
    const res = await fetch("/api/items/organize-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchStatus();
    } else {
      setError(data.error ?? "启动失败，请稍后重试");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 批量整理</CardTitle>
        <CardDescription>
          让 AI 重新给收藏分类、打标签，尽量沿用已有分类。
        </CardDescription>
      </CardHeader>
      {job && job.total > 0 && (
        <CardContent>
          <JobProgress job={job} doneLabel="上次整理完成" />
        </CardContent>
      )}
      <CardFooter className="flex items-center gap-2">
        <Select
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          items={MODE_LABELS}
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
        <Button size="lg" disabled={job?.running} onClick={start}>
          {job?.running ? "整理中…" : "开始整理"}
        </Button>
        {error && <span className="text-destructive text-sm">{error}</span>}
      </CardFooter>
    </Card>
  );
}
