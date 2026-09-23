import { api, toastError, toastSuccess } from "#lib/api";
import { useEffect, useState } from "react";
import { RotateCcwIcon, Trash2Icon } from "lucide-react";
import type { Item } from "@pickit/shared";
import { Card } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Favicon } from "#components/Favicon";
import { Confirm } from "#components/Confirm";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "#components/ui/empty";
import { PageLoading } from "#components/PageLoading";

export function TrashPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    return fetch("/api/items/trash")
      .then((r) => r.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function restore(item: Item) {
    try {
      await api(`/api/items/${item.id}/restore`, { method: "POST" });
      toastSuccess("已恢复", { description: item.name, id: "trash" });
    } catch (err) {
      toastError("恢复失败", err, { id: "trash" });
    }
    refresh();
  }

  async function purge(item: Item) {
    const ok = await Confirm.call({
      title: `彻底删除「${item.name}」？`,
      message: "删除后就无法找回了。",
      confirmLabel: "彻底删除",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/items/${item.id}/purge`, { method: "DELETE" });
      toastSuccess("已彻底删除", { description: item.name, id: "trash" });
    } catch (err) {
      toastError("删除失败", err, { id: "trash" });
    }
    refresh();
  }

  async function purgeAll() {
    const ok = await Confirm.call({
      title: `清空回收站（${items.length} 项）？`,
      message: "清空后就无法找回了。",
      confirmLabel: "清空",
      danger: true,
    });
    if (!ok) return;
    try {
      await api("/api/items/bulk", { json: { ids: items.map((i) => i.id), action: "purge" } });
      toastSuccess("回收站已清空", { id: "trash" });
    } catch (err) {
      toastError("清空失败", err, { id: "trash" });
    }
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-semibold text-lg">回收站</h1>
        {items.length > 0 && (
          <Button variant="outline" size="sm" onClick={purgeAll}>
            <Trash2Icon />
            清空回收站
          </Button>
        )}
      </div>

      {loading ? (
        <PageLoading />
      ) : items.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>回收站是空的</EmptyTitle>
            <EmptyDescription>删除的收藏会先进入这里，可以恢复。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid animate-fade-in gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <Card
              key={item.id}
              className="flex items-center justify-between gap-2 p-3 shadow-none before:shadow-none dark:before:shadow-none"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Favicon url={item.url} name={item.name} />
                <span className="truncate font-medium">{item.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="恢复"
                  onClick={() => restore(item)}
                >
                  <RotateCcwIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="彻底删除"
                  onClick={() => purge(item)}
                  className="text-muted-foreground hover:text-destructive-foreground"
                >
                  <Trash2Icon />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Confirm />
    </div>
  );
}
