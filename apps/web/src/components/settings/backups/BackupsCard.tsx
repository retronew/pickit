import { ArchiveIcon, DownloadIcon, EllipsisIcon, HistoryIcon, Trash2Icon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Badge } from "#components/ui/badge";
import { Skeleton } from "#components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "#components/ui/table";
import { Menu, MenuTrigger, MenuPopup, MenuItem, MenuSeparator } from "#components/ui/menu";
import { Confirm } from "#components/Confirm";
import { RestoreDialog } from "#components/settings/backups/RestoreDialog";
import { useBackups, type BackupInfo, type BackupKind } from "#hooks/useBackups";
import { formatBytes } from "#lib/format";
import { toastSuccess } from "#lib/api";
import { intlLocale, m } from "#lib/i18n";
import { Hint } from "#components/Hint";

const KIND: Record<BackupKind, { label: string; variant: "secondary" | "info" | "warning" }> = {
  daily: { label: m.backup_kind_daily(), variant: "secondary" },
  manual: { label: m.backup_kind_manual(), variant: "info" },
  "pre-restore": { label: m.backup_kind_pre_restore(), variant: "warning" },
};

const time = new Intl.DateTimeFormat(intlLocale(), {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function SkeletonRows() {
  return Array.from({ length: 3 }, (_, i) => (
    <TableRow key={i}>
      {["w-32", "w-12", "w-10", "w-14", "w-6"].map((w, j) => (
        <TableCell key={j}>
          <Skeleton className={`h-4 ${w}`} />
        </TableCell>
      ))}
    </TableRow>
  ));
}

export function BackupsCard() {
  const { backups, configured, error, creating, reload, create, remove } = useBackups();

  async function restore(b: BackupInfo) {
    const result = await RestoreDialog.call({ name: b.name });
    if (!result) return;
    toastSuccess(m.backup_restored(), {
      description: result.trashed
        ? m.backup_restored_trashed({ inserted: result.inserted, trashed: result.trashed })
        : m.backup_restored_count({ inserted: result.inserted }),
      id: "restore",
    });
    reload();
  }

  async function confirmRemove(b: BackupInfo) {
    const ok = await Confirm.call({
      title: m.backup_delete_title(),
      message: m.backup_delete_message({ name: b.name }),
      confirmLabel: m.action_delete(),
      danger: true,
    });
    if (ok) remove(b.name);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.backup_title()}</CardTitle>
        <CardDescription>
          {m.backup_description()}
        </CardDescription>
        {configured && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={create} loading={creating}>
              <ArchiveIcon />
              {m.backup_now()}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {!configured ? (
          <p className="text-muted-foreground text-sm">
            {m.backup_not_configured()}
          </p>
        ) : error && backups?.length === 0 ? (
          <p className="text-destructive text-sm">{m.load_failed({ error })}</p>
        ) : backups?.length === 0 ? (
          <p className="text-muted-foreground text-sm">{m.backup_none()}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.field_time()}</TableHead>
                <TableHead>{m.field_type()}</TableHead>
                <TableHead className="text-right">{m.backup_items()}</TableHead>
                <TableHead className="text-right">{m.field_size()}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody className={backups ? "animate-fade-in" : undefined}>
              {!backups ? (
                <SkeletonRows />
              ) : (
                backups.map((b) => (
                  <TableRow key={b.name}>
                    <Hint content={b.name}>
                      <TableCell className="tabular-nums">{time.format(b.uploaded)}</TableCell>
                    </Hint>
                    <TableCell>
                      <Badge variant={KIND[b.kind].variant}>{KIND[b.kind].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.count ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatBytes(b.size)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Menu>
                        <MenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={m.field_actions()} />}>
                          <EllipsisIcon />
                        </MenuTrigger>
                        <MenuPopup align="end">
                          <MenuItem onClick={() => restore(b)}>
                            <HistoryIcon />
                            {m.backup_restore()}
                          </MenuItem>
                          <MenuItem
                            render={<a href={`/api/backups/${encodeURIComponent(b.name)}`} download={b.name} />}
                          >
                            <DownloadIcon />
                            {m.action_download()}
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem variant="destructive" onClick={() => confirmRemove(b)}>
                            <Trash2Icon />
                            {m.action_delete()}
                          </MenuItem>
                        </MenuPopup>
                      </Menu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <RestoreDialog />
    </Card>
  );
}
