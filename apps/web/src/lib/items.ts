import type { Item } from "@pickit/shared";
import type { ItemFormPayload } from "#components/items/ItemFormDialog";
import { Confirm } from "#components/Confirm";
import { api, ApiError, toastSuccess } from "#lib/api";

/**
 * Creates or updates an item. Throws on failure so the form dialog can stay
 * open; returns false when the user declines saving a duplicate.
 */
export async function saveItem(payload: ItemFormPayload, item: Item | null): Promise<boolean> {
  const url = item ? `/api/items/${item.id}` : "/api/items";
  const method = item ? "PUT" : "POST";
  try {
    await api(url, { method, json: payload });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 409) throw err;
    const existing = err.data.existing as { name?: string } | undefined;
    const ok = await Confirm.call({
      title: "这条收藏已经存在",
      message: `「${existing?.name ?? "这条收藏"}」已经在你收藏里了，还要再存一条吗？`,
      confirmLabel: "继续保存",
    });
    if (!ok) return false;
    await api(url, { method, json: { ...payload, allowDuplicate: true } });
  }
  toastSuccess(item ? "已保存修改" : "已添加收藏", { description: payload.name, id: "item-save" });
  return true;
}
