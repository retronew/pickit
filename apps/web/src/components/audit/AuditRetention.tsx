import { useEffect, useState } from "react";
import { DatabaseIcon } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "#components/ui/select";
import { Input } from "#components/ui/input";
import { Skeleton } from "#components/ui/skeleton";
import { Button } from "#components/ui/button";
import { Confirm } from "#components/Confirm";
import { api, toastError, toastSuccess } from "#lib/api";
import { formatBytes, formatDate } from "#lib/format";

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
  "30": "30 天",
  "90": "90 天",
  "180": "180 天",
  "365": "1 年",
  "730": "2 年",
  "0": "永久保留",
  custom: "自定义…",
};

const retentionLabel = (days: number) => (days === 0 ? "永久保留" : `${days} 天`);

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
        title: `保留时间改为 ${days} 天？`,
        message: `早于 ${days} 天的审计记录会立即删除，无法恢复。`,
        confirmLabel: "确认修改",
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
      toastSuccess(`审计日志保留时间：${retentionLabel(res.retentionDays)}`, {
        description: res.deleted ? `已清理 ${res.deleted} 条过期记录` : undefined,
        id: "audit-retention",
      });
    } catch (err) {
      toastError("修改保留时间失败", err, { id: "audit-retention" });
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
  const items = current in PRESETS ? PRESETS : { ...PRESETS, custom: `${data.retentionDays} 天` };

  return (
    <div className="flex animate-fade-in flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <DatabaseIcon className="size-4" />
        共 <span className="font-medium text-foreground tabular-nums">{stats.count.toLocaleString()}</span> 条
        · 约 <span className="font-medium text-foreground">{formatBytes(stats.bytes)}</span>
        {stats.databaseBytes != null && <>（数据库共 {formatBytes(stats.databaseBytes)}）</>}
        {stats.oldest != null && <> · 最早 {formatDate(stats.oldest)}</>}
      </span>
      <span className="flex items-center gap-2 sm:ml-auto">
        <span className="text-muted-foreground">保留时间</span>
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
              aria-label="保留天数"
              autoFocus
            />
            <span className="text-muted-foreground">天</span>
            <Button size="sm" type="submit" disabled={saving || !custom}>
              保存
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setCustom(null)}>
              取消
            </Button>
          </form>
        )}
      </span>
    </div>
  );
}
