import { useCallback } from "react";
import type { Item } from "#hooks/useItems";
import { ItemFormDialog } from "#components/items/ItemFormDialog";
import { Confirm } from "#components/Confirm";
import { api, toastError, toastSuccess } from "#lib/api";
import { saveItem } from "#lib/items";

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
    toastSuccess("已恢复", { description: item.name, id: "item-delete" });
    refresh();
  } catch (err) {
    toastError("恢复失败", err, { id: "item-delete" });
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
        toastSuccess(item.pinned ? "已取消置顶" : "已置顶", {
          description: item.name,
          id: "item-pin",
        });
        refresh();
      } catch (err) {
        toastError(item.pinned ? "取消置顶失败" : "置顶失败", err, { id: "item-pin" });
      }
    },
    [refresh],
  );

  const deleteItem = useCallback(
    async (item: Item) => {
      const ok = await Confirm.call({
        title: `删除「${item.name}」？`,
        message: "删除后会放进回收站，随时可以恢复。",
        confirmLabel: "删除",
        danger: true,
      });
      if (!ok) return;
      try {
        await api(`/api/items/${item.id}`, { method: "DELETE" });
      } catch (err) {
        toastError("删除失败", err, { id: "item-delete" });
        return;
      }
      onDeleted?.(item);
      refresh();
      toastSuccess("已移到回收站", {
        description: item.name,
        id: "item-delete",
        action: { label: "撤销", onClick: () => restore(item, refresh) },
      });
    },
    [refresh, onDeleted],
  );

  return { addItem, editItem, togglePin, deleteItem };
}
