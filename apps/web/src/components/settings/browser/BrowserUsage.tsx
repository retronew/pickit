import type { BrowserRenderInfo } from "@pickit/shared";
import { Meter, MeterIndicator, MeterTrack } from "#components/ui/meter";
import { formatDateTime } from "#lib/format";
import { m } from "#lib/i18n";

const minutes = (ms: number) => (ms / 60_000).toFixed(1);

/** Browser time used this period against PickIt's own limit. */
export function BrowserUsage({ info }: { info: BrowserRenderInfo }) {
  const limitMs = info.limitMinutes * 60_000;
  const used = Math.min(info.usedMs, limitMs);
  const params = { used: minutes(info.usedMs), limit: String(info.limitMinutes) };
  return (
    <div className="space-y-1.5">
      <p className="text-sm">
        {info.period === "day" ? m.browser_render_used_today(params) : m.browser_render_used_month(params)}
        {info.usedMs >= limitMs && <span className="text-destructive"> · {m.browser_render_exhausted()}</span>}
      </p>
      <Meter value={used} max={limitMs} aria-label={m.browser_render_usage()}>
        <MeterTrack>
          <MeterIndicator />
        </MeterTrack>
      </Meter>
      <p className="text-muted-foreground text-xs">{m.browser_render_resets({ date: formatDateTime(info.resetsAt) })}</p>
    </div>
  );
}
