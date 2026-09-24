import { useEffect, useState } from "react";
import { createCallable } from "react-call";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "#components/ui/dialog";
import { Button } from "#components/ui/button";
import { Skeleton } from "#components/ui/skeleton";
import { SortableList } from "#components/SortableList";
import { api, toastError, toastSuccess } from "#lib/api";
import type { Share } from "#lib/shares";
import { m } from "#lib/i18n";

interface CollectionItem {
  id: number;
  name: string;
  url: string;
}

/** Drag a collection's bookmarks into a new order. Resolves to true when saved. */
export const CollectionOrderDialog = createCallable<{ share: Share }, boolean>(({ share, call }) => {
  const [entered, setEntered] = useState(false);
  const [items, setItems] = useState<CollectionItem[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    api<CollectionItem[]>(`/api/shares/${share.slug}/items`)
      .then(setItems)
      .catch((err) => {
        toastError(m.collection_order_load_failed(), err, { id: "share" });
        call.end(false);
      });
    return () => cancelAnimationFrame(raf);
  }, [share.slug, call]);

  async function save() {
    if (!items || saving) return;
    setSaving(true);
    try {
      await api(`/api/shares/${share.slug}`, { method: "PATCH", json: { ids: items.map((i) => i.id) } });
      toastSuccess(m.collection_order_saved(), { id: "share" });
      call.end(true);
    } catch (err) {
      toastError(m.collection_order_failed(), err, { id: "share" });
      setSaving(false);
    }
  }

  return (
    <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && call.end(false)}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{m.collection_order_title()}</DialogTitle>
          <DialogDescription>{m.collection_order_hint()}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {items ? (
            <SortableList
              items={items}
              getId={(i) => i.id}
              onChange={setItems}
              renderItem={(i) => (
                <>
                  <p className="truncate font-medium">{i.name}</p>
                  {i.url && <p className="truncate text-muted-foreground text-xs">{i.url}</p>}
                </>
              )}
            />
          ) : (
            <div className="space-y-1" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => call.end(false)}>
            {m.common_cancel()}
          </Button>
          <Button onClick={save} disabled={!items} loading={saving}>
            {m.common_save()}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}, 200);
