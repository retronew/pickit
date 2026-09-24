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
import {
  JobProgress,
  JobProgressSkeleton,
  JobActions,
  useJob,
  type JobKind,
} from "#components/settings/JobProgress";

export type JobMode = "missing" | "all";

/**
 * A background AI job over the library (batch organize, summaries): pick a
 * mode, start, and follow its progress / pause / retry.
 */
export function AiJobCard({
  kind,
  title,
  description,
  startLabel,
  modeLabels,
}: {
  kind: JobKind;
  title: string;
  description: string;
  startLabel: string;
  modeLabels: Record<JobMode, string>;
}) {
  const [mode, setMode] = useState<JobMode>("missing");
  const { job, error, run } = useJob(kind);
  const running = job?.status === "running";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
          onValueChange={(v) => setMode(v as JobMode)}
          items={modeLabels}
          disabled={running}
        >
          <SelectTrigger size="lg" className="w-auto min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(modeLabels) as JobMode[]).map((value) => (
              <SelectItem key={value} value={value}>
                {modeLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <JobActions job={job} startLabel={startLabel} onStart={() => run("start", { mode })} run={run} />
        {error && <span className="text-destructive text-sm">{error}</span>}
      </CardFooter>
    </Card>
  );
}
