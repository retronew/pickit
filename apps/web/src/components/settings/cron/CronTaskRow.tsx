import type { ReactNode } from "react";
import { ChevronDownIcon, PlayIcon } from "lucide-react";
import type { CronTaskView } from "@pickit/shared";
import { Button } from "#components/ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "#components/ui/collapsible";
import { Hint } from "#components/Hint";
import { CronRunStatus } from "#components/settings/cron/CronRunStatus";
import { CRON_TASK_LABELS, runSummary } from "#lib/cron";
import { formatDateTime, formatRelative } from "#lib/format";
import { m } from "#lib/i18n";

/** "5 分钟前" with the exact local time on hover. */
function When({ at }: { at: number }) {
  return (
    <Hint content={formatDateTime(at)}>
      <span className="tabular-nums">{formatRelative(at)}</span>
    </Hint>
  );
}

interface Props {
  task: CronTaskView;
  running: boolean;
  onRun: () => void;
  /** More actions for this task, before "run now". */
  actions?: ReactNode;
}

/** One scheduled task: what it does, how the last run went, the next run and its recent runs. */
export function CronTaskRow({ task, running, onRun, actions }: Props) {
  const label = CRON_TASK_LABELS[task.id];
  const last = task.lastRun;

  return (
    <Collapsible className="rounded-lg px-2 py-2.5 hover:bg-accent/40">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 sm:flex-nowrap">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-sm">{label.name()}</p>
            {last && <CronRunStatus status={last.status} />}
          </div>
          <p className="text-muted-foreground text-xs">{label.hint()}</p>
          <p className="text-muted-foreground text-xs">
            {last ? (
              <>
                {m.cron_last({ when: "" })}
                <When at={last.startedAt} />
                {last.status !== "skipped" && ` · ${runSummary(last)}`}
              </>
            ) : (
              m.cron_never_run()
            )}
            {task.nextAt && (
              <>
                {" · "}
                {m.cron_next({ when: "" })}
                <When at={task.nextAt} />
              </>
            )}
          </p>
          {last?.error && <p className="break-words text-destructive-foreground text-xs">{last.error}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {task.recent.length > 0 && (
            <CollapsibleTrigger
              render={<Button variant="ghost" size="sm" className="text-muted-foreground [&[data-panel-open]>svg]:rotate-180" />}
            >
              {m.cron_history()}
              <ChevronDownIcon className="transition-transform" />
            </CollapsibleTrigger>
          )}
          {actions}
          <Button variant="outline" size="sm" onClick={onRun} loading={running}>
            <PlayIcon />
            {m.cron_run_now()}
          </Button>
        </div>
      </div>
      <CollapsiblePanel>
        <ul className="mt-2 divide-y rounded-lg border text-xs">
          {task.recent.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="text-muted-foreground tabular-nums">{formatDateTime(run.startedAt)}</span>
              <CronRunStatus status={run.status} />
              {run.trigger === "manual" && <span className="text-muted-foreground">{m.cron_trigger_manual()}</span>}
              {run.status !== "skipped" && <span>{runSummary(run)}</span>}
              {run.error && <span className="w-full break-words text-destructive-foreground">{run.error}</span>}
            </li>
          ))}
        </ul>
      </CollapsiblePanel>
    </Collapsible>
  );
}
