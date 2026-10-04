import { useEffect, useState } from "react";
import { DatabaseIcon } from "lucide-react";
import { Skeleton } from "#components/ui/skeleton";
import { RetentionSelect, retentionLabel } from "#components/RetentionSelect";
import { api, toastError, toastSuccess } from "#lib/api";
import { formatBytes, formatDate } from "#lib/format";
import { intlLocale, m } from "#lib/i18n";

interface Stats {
  count: number;
  bytes: number;
  oldest: number | null;
  databaseBytes: number | null;
}

interface AuditSettings {
  retentionDays: number;
  maxRetentionDays: number;
  stats: Stats;
}

/** Usage of the audit log and how long entries are kept. */
export function AuditRetention({ reloadKey }: { reloadKey: unknown }) {
  const [data, setData] = useState<AuditSettings | null>(null);

  useEffect(() => {
    api<AuditSettings>("/api/audit/settings")
      .then(setData)
      .catch(() => {});
  }, [reloadKey]);

  async function save(days: number) {
    try {
      const res = await api<{ retentionDays: number; deleted: number; stats: Stats }>(
        "/api/audit/settings",
        { method: "PUT", json: { retentionDays: days } },
      );
      setData((d) => d && { ...d, retentionDays: res.retentionDays, stats: res.stats });
      toastSuccess(m.retention_saved({ retention: retentionLabel(res.retentionDays) }), {
        description: res.deleted ? m.retention_pruned({ count: res.deleted }) : undefined,
        id: "audit-retention",
      });
    } catch (err) {
      toastError(m.retention_failed(), err, { id: "audit-retention" });
      throw err;
    }
  }

  if (!data) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-3 py-2.5">
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
    );
  }
  const { stats } = data;
  return (
    <div className="flex animate-fade-in items-center gap-x-4 gap-y-2 rounded-xl border sm:flex-wrap bg-muted/30 px-3 py-2 text-sm">
      {/* Phones: totals on the first line, database size and oldest date below. */}
      <span className="flex min-w-0 items-start gap-1.5 text-muted-foreground sm:items-center">
        <DatabaseIcon className="mt-0.5 size-4 shrink-0 sm:mt-0" />
        <span className="flex min-w-0 flex-col sm:flex-row sm:flex-wrap sm:gap-x-1">
          <span>
            {m.audit_usage({ count: stats.count.toLocaleString(intlLocale()), size: formatBytes(stats.bytes) })}
          </span>
          {(stats.databaseBytes != null || stats.oldest != null) && (
            <span className="text-xs sm:text-sm">
              <span className="max-sm:hidden">· </span>
              {[
                stats.databaseBytes != null && m.audit_usage_database({ size: formatBytes(stats.databaseBytes) }),
                stats.oldest != null && m.audit_usage_oldest({ date: formatDate(stats.oldest) }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </span>
      </span>
      <RetentionSelect
        value={data.retentionDays}
        max={data.maxRetentionDays}
        confirmMessage={(days) => m.retention_confirm_message({ days })}
        onSave={save}
      />
    </div>
  );
}
