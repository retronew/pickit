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

const KIND: Record<BackupKind, { label: string; variant: "secondary" | "info" | "warning" }> = {
  daily: { label: "每日", variant: "secondary" },
  manual: { label: "手动", variant: "info" },
  "pre-restore": { label: "恢复前", variant: "warning" },
};

const time = new Intl.DateTimeFormat("zh-CN", {
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
    toastSuccess("已恢复备份", {
      description: `恢复 ${result.inserted} 条${result.trashed ? `，${result.trashed} 条移到回收站` : ""}`,
      id: "restore",
    });
    reload();
  }

  async function confirmRemove(b: BackupInfo) {
    const ok = await Confirm.call({
      title: "删除这个备份？",
      message: `${b.name} 删除后无法找回。`,
      confirmLabel: "删除",
      danger: true,
    });
    if (ok) remove(b.name);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>备份与恢复</CardTitle>
        <CardDescription>
          每天自动备份到 R2，保留 30 天。恢复前会自动再备份一次当前数据。
        </CardDescription>
        {configured && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={create} loading={creating}>
              <ArchiveIcon />
              立即备份
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {!configured ? (
          <p className="text-muted-foreground text-sm">
            没有配置 R2 备份存储。在 wrangler.jsonc 里绑定 BACKUPS 后即可使用。
          </p>
        ) : error && backups?.length === 0 ? (
          <p className="text-destructive text-sm">加载失败：{error}</p>
        ) : backups?.length === 0 ? (
          <p className="text-muted-foreground text-sm">还没有备份，点「立即备份」创建第一个。</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-right">收藏数</TableHead>
                <TableHead className="text-right">大小</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody className={backups ? "animate-fade-in" : undefined}>
              {!backups ? (
                <SkeletonRows />
              ) : (
                backups.map((b) => (
                  <TableRow key={b.name}>
                    <TableCell className="tabular-nums" title={b.name}>
                      {time.format(b.uploaded)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={KIND[b.kind].variant}>{KIND[b.kind].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.count ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatBytes(b.size)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Menu>
                        <MenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="操作" />}>
                          <EllipsisIcon />
                        </MenuTrigger>
                        <MenuPopup align="end">
                          <MenuItem onClick={() => restore(b)}>
                            <HistoryIcon />
                            恢复…
                          </MenuItem>
                          <MenuItem
                            render={<a href={`/api/backups/${encodeURIComponent(b.name)}`} download={b.name} />}
                          >
                            <DownloadIcon />
                            下载
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem variant="destructive" onClick={() => confirmRemove(b)}>
                            <Trash2Icon />
                            删除
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
