import type { CronRunStatus as Status } from "@pickit/shared";
import { Badge } from "#components/ui/badge";
import { m } from "#lib/i18n";

const LABELS: Record<Status, () => string> = {
  ok: m.cron_status_ok,
  skipped: m.cron_status_skipped,
  error: m.cron_status_error,
};
const VARIANTS: Record<Status, "success" | "secondary" | "destructive"> = {
  ok: "success",
  skipped: "secondary",
  error: "destructive",
};

/** The outcome of one scheduled task run. */
export function CronRunStatus({ status }: { status: Status }) {
  return (
    <Badge variant={VARIANTS[status]} size="sm" className="shrink-0">
      {LABELS[status]()}
    </Badge>
  );
}
