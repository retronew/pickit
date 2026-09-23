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
import { m } from "#lib/i18n";

type Mode = "missing" | "all";

const MODE_LABELS: Record<Mode, string> = {
  missing: m.organize_mode_missing(),
  all: m.organize_mode_all(),
};

export function OrganizeCard() {
  const [mode, setMode] = useState<Mode>("missing");
  const { job, error, run } = useJob("organize");
  const running = job?.status === "running";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.organize_job_title()}</CardTitle>
        <CardDescription>
          {m.organize_job_description()}
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
            {(Object.keys(MODE_LABELS) as Mode[]).map((mode) => (
              <SelectItem key={mode} value={mode}>
                {MODE_LABELS[mode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <JobActions job={job} startLabel={m.organize_job_start()} onStart={() => run("start", { mode })} run={run} />
        {error && <span className="text-destructive text-sm">{error}</span>}
      </CardFooter>
    </Card>
  );
}
