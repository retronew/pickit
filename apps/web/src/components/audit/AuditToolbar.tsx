import { RefreshCwIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { Switch } from "#components/ui/switch";
import { Label } from "#components/ui/label";
import { cn } from "#lib/utils";

const clock = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Live toggle, manual refresh and the last update time. */
export function AuditToolbar({
  live,
  onLiveChange,
  onRefresh,
  refreshing,
  updatedAt,
}: {
  live: boolean;
  onLiveChange: (live: boolean) => void;
  onRefresh: () => void;
  refreshing: boolean;
  updatedAt: number | null;
}) {
  return (
    <div className="flex items-center gap-3">
      {updatedAt && (
        <span className="hidden text-muted-foreground text-xs sm:inline">
          更新于 {clock.format(updatedAt)}
        </span>
      )}
      <Label className="flex items-center gap-2 text-sm">
        <Switch checked={live} onCheckedChange={onLiveChange} />
        实时刷新
        {live && (
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
        )}
      </Label>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
        <RefreshCwIcon className={cn(refreshing && "animate-spin")} />
        刷新
      </Button>
    </div>
  );
}
