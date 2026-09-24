import { RefreshCwIcon } from "lucide-react";
import { activityLevel, parseProjectUrl } from "@pickit/shared";
import { Button } from "#components/ui/button";
import { Hint } from "#components/Hint";
import { ActivityBadge } from "#components/items/ActivityBadge";
import { useProjectActivity } from "#hooks/useProjectActivity";
import type { Item } from "#hooks/useItems";
import { activityErrorText, formatCompact } from "#lib/activity";
import { formatDateTime, formatRelative } from "#lib/format";
import { m } from "#lib/i18n";

/** Project activity of a GitHub / npm bookmark in the detail panel. Hidden for other URLs. */
export function ProjectActivityPanel({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const { activity, busy, refresh } = useProjectActivity(item.id, item.activity, onChanged);
  const ref = parseProjectUrl(item.url);
  if (!ref) return null;

  const level = activityLevel(activity);
  const when = (ts: number) => (
    <Hint content={formatDateTime(ts)}>
      <span>{formatRelative(ts)}</span>
    </Hint>
  );
  const rows: [string, React.ReactNode][] = [];
  if (activity?.lastActivityAt) {
    rows.push([ref.source === "github" ? m.activity_last_push() : m.activity_last_publish(), when(activity.lastActivityAt)]);
  }
  if (activity?.latestVersion) {
    rows.push([
      m.activity_latest_version(),
      <>
        {activity.latestVersion}
        {activity.latestReleaseAt ? <> · {when(activity.latestReleaseAt)}</> : null}
      </>,
    ]);
  }
  if (activity?.stars !== undefined) rows.push([m.activity_stars(), formatCompact(activity.stars)]);
  if (activity?.weeklyDownloads !== undefined) rows.push([m.activity_downloads(), formatCompact(activity.weeklyDownloads)]);

  return (
    <div className="space-y-2 rounded-lg border px-3 py-2.5">
      <div className="flex items-center gap-2">
        <p className="font-medium text-sm">{ref.source === "github" ? m.activity_title_github() : m.activity_title_npm()}</p>
        {level && <ActivityBadge level={level} />}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={refresh} loading={busy}>
          <RefreshCwIcon />
          {m.activity_refresh()}
        </Button>
      </div>
      {rows.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-muted-foreground text-xs">{activity ? m.activity_no_data() : m.activity_not_checked()}</p>
      )}
      {activity && (
        <p className="text-muted-foreground text-xs">
          {m.activity_checked({ date: formatRelative(activity.checkedAt) })}
          {activity.error && <span className="text-destructive-foreground"> · {activityErrorText(activity.error)}</span>}
        </p>
      )}
    </div>
  );
}
