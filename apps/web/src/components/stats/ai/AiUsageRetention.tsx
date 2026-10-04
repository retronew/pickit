import { DatabaseIcon } from "lucide-react";
import { Skeleton } from "#components/ui/skeleton";
import { RetentionSelect } from "#components/RetentionSelect";
import { useAiUsageRetention } from "#hooks/useAiUsage";
import { formatCount } from "#lib/ai-usage";
import { formatDate } from "#lib/format";
import { m } from "#lib/i18n";

/** How many usage records there are and how long they are kept. */
export function AiUsageRetention() {
  const { retention, save } = useAiUsageRetention();

  if (!retention) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-3 py-2.5">
        <Skeleton className="h-4 w-56 max-w-full" />
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
    );
  }
  return (
    <div className="flex animate-fade-in items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm sm:flex-wrap">
      <span className="flex min-w-0 items-start gap-1.5 text-muted-foreground sm:items-center">
        <DatabaseIcon className="mt-0.5 size-4 shrink-0 sm:mt-0" />
        <span className="flex min-w-0 flex-col sm:flex-row sm:gap-x-1">
          <span>{m.ai_usage_records({ count: formatCount(retention.count) })}</span>
          {retention.oldest != null && (
            <span className="text-xs sm:text-sm">
              <span className="max-sm:hidden">· </span>
              {m.audit_usage_oldest({ date: formatDate(retention.oldest) })}
            </span>
          )}
        </span>
      </span>
      <RetentionSelect
        value={retention.retentionDays}
        max={retention.maxRetentionDays}
        confirmMessage={(days) => m.ai_usage_retention_confirm_message({ days })}
        onSave={save}
      />
    </div>
  );
}
