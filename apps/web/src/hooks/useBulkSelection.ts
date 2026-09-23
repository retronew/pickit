import { useCallback, useState } from "react";
import type { Item } from "@pickit/shared";
import { Confirm } from "#components/Confirm";
import { TagsEditDialog } from "#components/items/TagsEditDialog";
import { OrganizeReviewDialog } from "#components/items/OrganizeReviewDialog";
import { api, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

export type BulkAction = "delete" | "pin" | "unpin" | "category";

/** Select mode on the items page and the bulk actions on the selection. */
export function useBulkSelection(refresh: () => void, items: Item[], allTags: string[]) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function bulkAction(action: BulkAction, value?: string) {
    const count = selectedIds.size;
    if (count === 0) return;
    try {
      await api("/api/items/bulk", { json: { ids: [...selectedIds], action, value } });
    } catch (err) {
      toastError(m.bulk_failed(), err, { id: "item-bulk" });
      return;
    }
    const done = {
      delete: m.bulk_done_delete({ count }),
      pin: m.bulk_done_pin({ count }),
      unpin: m.bulk_done_unpin({ count }),
      category: m.bulk_done_category({ count, category: value || m.uncategorized() }),
    }[action];
    toastSuccess(done, { id: "item-bulk" });
    exitSelectMode();
    refresh();
  }

  async function editTags(mode: "add" | "remove") {
    const ids = [...selectedIds];
    const suggestions =
      mode === "add"
        ? allTags
        : [...new Set(items.filter((i) => selectedIds.has(i.id)).flatMap((i) => i.tags))].sort();
    const tags = await TagsEditDialog.call({ mode, count: ids.length, suggestions });
    if (!tags) return;
    try {
      const res = await api<{ changed: number }>("/api/items/bulk", {
        json: { ids, action: mode === "add" ? "add_tags" : "remove_tags", tags },
      });
      toastSuccess(mode === "add" ? m.tags_added() : m.tags_removed(), {
        description: m.tags_changed({ count: res.changed, tags: tags.map((t) => `#${t}`).join(" ") }),
        id: "item-bulk",
      });
      refresh();
    } catch (err) {
      toastError(mode === "add" ? m.tags_add_failed() : m.tags_remove_failed(), err, { id: "item-bulk" });
    }
  }

  async function aiOrganize() {
    const applied = await OrganizeReviewDialog.call({ ids: [...selectedIds] });
    if (!applied) return;
    toastSuccess(m.organize_applied({ count: applied }), { id: "item-bulk" });
    exitSelectMode();
    refresh();
  }

  async function bulkDelete() {
    const ok = await Confirm.call({
      title: m.bulk_delete_title({ count: selectedIds.size }),
      message: m.delete_to_trash_hint(),
      confirmLabel: m.action_delete(),
      danger: true,
    });
    if (ok) await bulkAction("delete");
  }

  return {
    selectMode,
    startSelect: () => setSelectMode(true),
    exitSelectMode,
    selectedIds,
    toggleSelect,
    bulkAction,
    bulkDelete,
    editTags,
    aiOrganize,
  };
}
