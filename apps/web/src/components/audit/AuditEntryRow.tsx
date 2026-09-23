import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Badge } from "#components/ui/badge";
import { cn } from "#lib/utils";
import { actionLabel, isFailure, type AuditEntry } from "#lib/audit";

const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function StatusBadge({ entry }: { entry: AuditEntry }) {
  if (entry.status == null) return null;
  return isFailure(entry) ? (
    <Badge variant="error">失败 {entry.status}</Badge>
  ) : (
    <Badge variant="success">成功</Badge>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </div>
  );
}

export function AuditEntryRow({ entry, fresh }: { entry: AuditEntry; fresh: boolean }) {
  const [open, setOpen] = useState(false);
  const { method, path, durationMs, ...rest } = entry.detail as {
    method?: string;
    path?: string;
    durationMs?: number;
  } & Record<string, unknown>;

  return (
    <li className={cn("border-b last:border-b-0", fresh && "animate-fade-in bg-accent/40")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left text-sm hover:bg-accent/50 sm:grid-cols-[auto_8.5rem_7rem_1fr_auto]"
      >
        <ChevronRightIcon
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-90")}
        />
        <time
          className="text-muted-foreground tabular-nums text-xs"
          dateTime={new Date(entry.createdAt).toISOString()}
        >
          {timeFormat.format(entry.createdAt)}
        </time>
        <span className="hidden truncate font-medium sm:block">{actionLabel(entry.action)}</span>
        <span className="col-span-2 min-w-0 sm:col-span-1">
          <span className="block truncate">{entry.summary || actionLabel(entry.action)}</span>
          <span className="block truncate text-muted-foreground text-xs">{entry.actor}</span>
        </span>
        <span className="col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto">
          <StatusBadge entry={entry} />
        </span>
      </button>
      {open && (
        <dl className="space-y-1.5 bg-muted/40 px-3 py-3 pl-10 text-xs">
          <DetailRow label="动作">
            <code>{entry.action}</code>
          </DetailRow>
          {entry.target && <DetailRow label="对象">{entry.target}</DetailRow>}
          {path && (
            <DetailRow label="请求">
              <code>
                {method} {path}
              </code>
              {durationMs != null && <span className="text-muted-foreground"> · {durationMs} ms</span>}
            </DetailRow>
          )}
          {entry.ip && <DetailRow label="IP">{entry.ip}</DetailRow>}
          {entry.userAgent && <DetailRow label="客户端">{entry.userAgent}</DetailRow>}
          {Object.keys(rest).length > 0 && (
            <DetailRow label="详情">
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-background p-2 font-mono">
                {JSON.stringify(rest, null, 2)}
              </pre>
            </DetailRow>
          )}
        </dl>
      )}
    </li>
  );
}
