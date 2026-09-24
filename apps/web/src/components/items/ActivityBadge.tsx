import type { ActivityLevel } from "@pickit/shared";
import { Badge } from "#components/ui/badge";
import { ACTIVITY_LABELS, ACTIVITY_VARIANTS } from "#lib/activity";
import { cn } from "#lib/utils";

/** How active a GitHub / npm project is, as a small colored badge. */
export function ActivityBadge({ level, className }: { level: ActivityLevel; className?: string }) {
  return (
    <Badge variant={ACTIVITY_VARIANTS[level]} size="sm" className={cn("shrink-0 rounded-full px-1.5", className)}>
      {ACTIVITY_LABELS[level]()}
    </Badge>
  );
}
