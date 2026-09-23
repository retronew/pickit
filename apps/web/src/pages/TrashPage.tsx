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
import { m } from "#lib/i18n";

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
      toastSuccess(m.restored(), { description: item.name, id: "trash" });
    } catch (err) {
      toastError(m.restore_failed(), err, { id: "trash" });
    }
    refresh();
  }

  async function purge(item: Item) {
    const ok = await Confirm.call({
      title: m.purge_title({ name: item.name }),
      message: m.purge_message(),
      confirmLabel: m.action_purge(),
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/items/${item.id}/purge`, { method: "DELETE" });
      toastSuccess(m.purged(), { description: item.name, id: "trash" });
    } catch (err) {
      toastError(m.delete_failed(), err, { id: "trash" });
    }
    refresh();
  }

  async function purgeAll() {
    const ok = await Confirm.call({
      title: m.empty_trash_title({ count: items.length }),
      message: m.empty_trash_message(),
      confirmLabel: m.empty_trash_confirm(),
      danger: true,
    });
    if (!ok) return;
    try {
      await api("/api/items/bulk", { json: { ids: items.map((i) => i.id), action: "purge" } });
      toastSuccess(m.trash_emptied(), { id: "trash" });
    } catch (err) {
      toastError(m.empty_trash_failed(), err, { id: "trash" });
    }
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-semibold text-lg">{m.nav_trash()}</h1>
        {items.length > 0 && (
          <Button variant="outline" size="sm" onClick={purgeAll}>
            <Trash2Icon />
            {m.empty_trash()}
          </Button>
        )}
      </div>

      {loading ? (
        <PageLoading />
      ) : items.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>{m.trash_empty()}</EmptyTitle>
            <EmptyDescription>{m.trash_empty_hint()}</EmptyDescription>
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
                  aria-label={m.action_restore()}
                  onClick={() => restore(item)}
                >
                  <RotateCcwIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={m.action_purge()}
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
