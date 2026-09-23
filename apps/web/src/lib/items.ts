import type { Item } from "@pickit/shared";
import type { ItemFormPayload } from "#components/items/ItemFormDialog";
import { Confirm } from "#components/Confirm";
import { api, ApiError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

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
      title: m.dup_title(),
      message: m.dup_message({ name: existing?.name ?? m.dup_this_item() }),
      confirmLabel: m.dup_save_anyway(),
    });
    if (!ok) return false;
    await api(url, { method, json: { ...payload, allowDuplicate: true } });
  }
  toastSuccess(item ? m.item_saved() : m.item_added(), { description: payload.name, id: "item-save" });
  return true;
}
