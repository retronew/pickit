import { useEffect, useState } from "react";
import { DatabaseIcon } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "#components/ui/select";
import { Input } from "#components/ui/input";
import { Skeleton } from "#components/ui/skeleton";
import { Button } from "#components/ui/button";
import { Confirm } from "#components/Confirm";
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

const PRESETS: Record<string, string> = {
  "30": m.retention_days({ days: 30 }),
  "90": m.retention_days({ days: 90 }),
  "180": m.retention_days({ days: 180 }),
  "365": m.retention_years({ years: 1 }),
  "730": m.retention_years({ years: 2 }),
  "0": m.retention_forever(),
  custom: m.retention_custom(),
};

const retentionLabel = (days: number) => (days === 0 ? m.retention_forever() : m.retention_days({ days }));

/** Usage of the audit log and how long entries are kept. */
export function AuditRetention({ reloadKey }: { reloadKey: unknown }) {
  const [data, setData] = useState<AuditSettings | null>(null);
  const [custom, setCustom] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<AuditSettings>("/api/audit/settings")
      .then(setData)
      .catch(() => {});
  }, [reloadKey]);

  async function save(days: number) {
    if (!data || days === data.retentionDays) return;
    const shorter = days !== 0 && (data.retentionDays === 0 || days < data.retentionDays);
    if (shorter) {
      const ok = await Confirm.call({
        title: m.retention_confirm_title({ days }),
        message: m.retention_confirm_message({ days }),
        confirmLabel: m.retention_confirm(),
        danger: true,
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await api<{ retentionDays: number; deleted: number; stats: Stats }>(
        "/api/audit/settings",
        { method: "PUT", json: { retentionDays: days } },
      );
      setData({ ...data, retentionDays: res.retentionDays, stats: res.stats });
      setCustom(null);
      toastSuccess(m.retention_saved({ retention: retentionLabel(res.retentionDays) }), {
        description: res.deleted ? m.retention_pruned({ count: res.deleted }) : undefined,
        id: "audit-retention",
      });
    } catch (err) {
      toastError(m.retention_failed(), err, { id: "audit-retention" });
    } finally {
      setSaving(false);
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
  const current = String(data.retentionDays);
  const selectValue = custom !== null ? "custom" : current in PRESETS ? current : "custom";
  const items = current in PRESETS ? PRESETS : { ...PRESETS, custom: m.retention_days({ days: data.retentionDays }) };

  return (
    <div className="flex animate-fade-in flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <DatabaseIcon className="size-4" />
        {m.audit_usage({ count: stats.count.toLocaleString(intlLocale()), size: formatBytes(stats.bytes) })}
        {stats.databaseBytes != null && ` ${m.audit_usage_database({ size: formatBytes(stats.databaseBytes) })}`}
        {stats.oldest != null && ` · ${m.audit_usage_oldest({ date: formatDate(stats.oldest) })}`}
      </span>
      <span className="flex items-center gap-2 sm:ml-auto">
        <span className="text-muted-foreground">{m.retention_label()}</span>
        <Select
          value={selectValue}
          items={items}
          disabled={saving}
          onValueChange={(v) => {
            if (v === "custom") setCustom(current === "0" ? "" : current);
            else if (v != null) save(Number(v));
          }}
        >
          <SelectTrigger size="sm" className="w-auto min-w-28 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {Object.entries(items).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        {custom !== null && (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const days = Number(custom);
              if (Number.isInteger(days) && days >= 1 && days <= data.maxRetentionDays) save(days);
            }}
          >
            <Input
              size="sm"
              type="number"
              min={1}
              max={data.maxRetentionDays}
              className="w-20"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              aria-label={m.retention_days_label()}
              autoFocus
            />
            <span className="text-muted-foreground">{m.retention_day_unit()}</span>
            <Button size="sm" type="submit" disabled={saving || !custom}>
              {m.common_save()}
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setCustom(null)}>
              {m.common_cancel()}
            </Button>
          </form>
        )}
      </span>
    </div>
  );
}
