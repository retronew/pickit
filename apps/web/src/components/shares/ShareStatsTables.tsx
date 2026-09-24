import { Badge } from "#components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#components/ui/table";
import type { ShareVisit } from "#hooks/useShareStats";
import { formatCountry, formatDateTime } from "#lib/format";
import { m } from "#lib/i18n";

const DEVICE_LABELS: Record<string, () => string> = {
  desktop: m.share_stats_device_desktop,
  mobile: m.share_stats_device_mobile,
  tablet: m.share_stats_device_tablet,
};

function Section({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="font-medium text-sm">{title}</p>
      {empty ? <p className="text-muted-foreground text-xs">{m.share_stats_none()}</p> : children}
    </div>
  );
}

/** A ranked list (top referrers, countries) as a two-column table. */
export function TopTable({ title, column, rows }: { title: string; column: string; rows: { label: string; count: number }[] }) {
  return (
    <Section title={title} empty={rows.length === 0}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{column}</TableHead>
            <TableHead className="text-right">{m.share_stats_col_count()}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}>
              <TableCell className="max-w-0 truncate">{r.label}</TableCell>
              <TableCell className="w-16 text-right tabular-nums">{r.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

/** "Chrome · macOS · 电脑" */
function deviceText(v: ShareVisit): string {
  return [v.browser, v.os, DEVICE_LABELS[v.device]?.()].filter(Boolean).join(" · ") || "—";
}

/** The latest visits; region and device columns hide on narrow screens. */
export function RecentVisitsTable({ visits }: { visits: ShareVisit[] }) {
  return (
    <Section title={m.share_stats_recent()} empty={visits.length === 0}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{m.share_stats_col_time()}</TableHead>
            <TableHead>{m.share_stats_col_source()}</TableHead>
            <TableHead className="max-sm:hidden">{m.share_stats_col_region()}</TableHead>
            <TableHead className="max-sm:hidden">{m.share_stats_col_device()}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visits.map((v, i) => (
            <TableRow key={i}>
              <TableCell className="text-muted-foreground tabular-nums">{formatDateTime(v.at)}</TableCell>
              <TableCell className="max-w-40 truncate">
                {v.kind === "rss" && (
                  <Badge size="sm" variant="outline" className="me-1.5">
                    RSS
                  </Badge>
                )}
                {v.referrer || m.share_stats_direct()}
              </TableCell>
              <TableCell className="max-sm:hidden">{v.country ? formatCountry(v.country) : "—"}</TableCell>
              <TableCell className="max-w-44 truncate max-sm:hidden">{deviceText(v)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}
