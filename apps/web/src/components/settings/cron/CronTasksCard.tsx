import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "#components/ui/card";
import { ListSkeleton } from "#components/settings/skeletons";
import { CronTaskRow } from "#components/settings/cron/CronTaskRow";
import { RecaptureAllButton } from "#components/settings/cron/RecaptureAllButton";
import { useCron } from "#hooks/useCron";
import { scheduleLabel } from "#lib/cron";
import { formatDateTime, formatRelative } from "#lib/format";
import { m } from "#lib/i18n";
import { Hint } from "#components/Hint";
import { LiveRefreshControls } from "#components/LiveRefreshControls";
import { usePersistentFlag } from "#hooks/usePersistentFlag";
import { SettingsTabHeader } from "#components/settings/SettingsTabHeader";

/**
 * Scheduled tasks grouped by trigger (every minute / daily), with runs and
 * next run times. Renders the tab's description with the refresh controls beside it.
 */
export function CronTasksCard({ description }: { description: string }) {
  const [live, setLive] = usePersistentFlag("pickit-cron-live", true);
  const { overview, running, refreshing, updatedAt, reload, runNow } = useCron(live);
  const groups = overview ? [...new Set(overview.tasks.map((t) => t.cron))] : [];

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        description={description}
        actions={
          <LiveRefreshControls
            live={live}
            onLiveChange={setLive}
            onRefresh={reload}
            refreshing={refreshing}
            updatedAt={updatedAt}
          />
        }
      />
      {overview === null ? (
        <Card>
          <CardContent className="pt-6">
            <ListSkeleton rows={4} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
        {groups.map((cron) => {
          const tasks = overview.tasks.filter((t) => t.cron === cron);
          const tick = overview.lastTicks[cron];
          return (
            <Card key={cron} className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-baseline gap-x-2">
                  {scheduleLabel(cron, tasks[0]?.nextAt ?? null)}
                  <code className="font-normal text-muted-foreground text-xs">{cron} (UTC)</code>
                </CardTitle>
                <CardDescription>
                  {tick ? (
                    <Hint content={formatDateTime(tick)}>
                      <span>{m.cron_tick({ when: formatRelative(tick) })}</span>
                    </Hint>
                  ) : (
                    m.cron_tick_never()
                  )}
                  {cron === "* * * * *" && ` · ${m.cron_quiet_hint()}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="-mx-2 space-y-1">
                {tasks.map((task) => (
                  <CronTaskRow
                    key={task.id}
                    task={task}
                    running={running === task.id}
                    onRun={() => runNow(task.id)}
                    actions={task.id === "content" && <RecaptureAllButton onDone={reload} />}
                  />
                ))}
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
}
