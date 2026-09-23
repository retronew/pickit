import { useCallback } from "react";
import type { Item } from "#hooks/useItems";
import { ItemFormDialog } from "#components/items/ItemFormDialog";
import { Confirm } from "#components/Confirm";
import { api, toastError, toastSuccess } from "#lib/api";
import { saveItem } from "#lib/items";
import { m } from "#lib/i18n";

interface Options {
  refresh: () => void;
  categories: string[];
  allTags: string[];
  /** Called after an item is moved to the trash. */
  onDeleted?: (item: Item) => void;
}

async function restore(item: Item, refresh: () => void) {
  try {
    await api(`/api/items/${item.id}/restore`, { method: "POST" });
    toastSuccess(m.restored(), { description: item.name, id: "item-delete" });
    refresh();
  } catch (err) {
    toastError(m.restore_failed(), err, { id: "item-delete" });
  }
}

/** Add / edit / pin / delete for single items, with toasts. */
export function useItemActions({ refresh, categories, allTags, onDeleted }: Options) {
  const addItem = useCallback(async () => {
    const payload = await ItemFormDialog.call({
      item: null,
      categories,
      allTags,
      onSubmit: (p) => saveItem(p, null),
    });
    if (payload) refresh();
  }, [categories, allTags, refresh]);

  const editItem = useCallback(
    async (item: Item) => {
      const payload = await ItemFormDialog.call({
        item,
        categories,
        allTags,
        onSubmit: (p) => saveItem(p, item),
      });
      if (payload) refresh();
    },
    [categories, allTags, refresh],
  );

  const togglePin = useCallback(
    async (item: Item) => {
      try {
        await api(`/api/items/${item.id}`, { method: "PUT", json: { pinned: !item.pinned } });
        toastSuccess(item.pinned ? m.unpinned() : m.pinned(), {
          description: item.name,
          id: "item-pin",
        });
        refresh();
      } catch (err) {
        toastError(item.pinned ? m.unpin_failed() : m.pin_failed(), err, { id: "item-pin" });
      }
    },
    [refresh],
  );

  const deleteItem = useCallback(
    async (item: Item) => {
      const ok = await Confirm.call({
        title: m.delete_item_title({ name: item.name }),
        message: m.delete_to_trash_hint(),
        confirmLabel: m.action_delete(),
        danger: true,
      });
      if (!ok) return;
      try {
        await api(`/api/items/${item.id}`, { method: "DELETE" });
      } catch (err) {
        toastError(m.delete_failed(), err, { id: "item-delete" });
        return;
      }
      onDeleted?.(item);
      refresh();
      toastSuccess(m.moved_to_trash(), {
        description: item.name,
        id: "item-delete",
        action: { label: m.undo(), onClick: () => restore(item, refresh) },
      });
    },
    [refresh, onDeleted],
  );

  return { addItem, editItem, togglePin, deleteItem };
}
