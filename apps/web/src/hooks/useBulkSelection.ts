import { useCallback, useState } from "react";
import type { Item } from "@pickit/shared";
import { Confirm } from "#components/Confirm";
import { TagsEditDialog } from "#components/items/TagsEditDialog";
import { OrganizeReviewDialog } from "#components/items/OrganizeReviewDialog";
import { api, toastError, toastSuccess } from "#lib/api";

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
      toastError("批量操作失败", err, { id: "item-bulk" });
      return;
    }
    const done = {
      delete: `已将 ${count} 项移到回收站`,
      pin: `已置顶 ${count} 项`,
      unpin: `已取消置顶 ${count} 项`,
      category: `已将 ${count} 项移到「${value || "未分类"}」`,
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
      toastSuccess(mode === "add" ? "已添加标签" : "已移除标签", {
        description: `${res.changed} 项有变化：${tags.map((t) => `#${t}`).join(" ")}`,
        id: "item-bulk",
      });
      refresh();
    } catch (err) {
      toastError(mode === "add" ? "添加标签失败" : "移除标签失败", err, { id: "item-bulk" });
    }
  }

  async function aiOrganize() {
    const applied = await OrganizeReviewDialog.call({ ids: [...selectedIds] });
    if (!applied) return;
    toastSuccess(`已按 AI 建议整理 ${applied} 项`, { id: "item-bulk" });
    exitSelectMode();
    refresh();
  }

  async function bulkDelete() {
    const ok = await Confirm.call({
      title: `删除选中的 ${selectedIds.size} 项？`,
      message: "删除后会放进回收站，随时可以恢复。",
      confirmLabel: "删除",
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
