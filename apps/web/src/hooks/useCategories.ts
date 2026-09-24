import { useCallback, useEffect, useState } from "react";
import { CategoryPickerDialog } from "#components/categories/CategoryPickerDialog";
import { Confirm } from "#components/Confirm";
import { Prompt } from "#components/Prompt";
import { api, toastError, toastSuccess } from "#lib/api";
import {
  categoryTree,
  isWithinCategory,
  joinCategory,
  parentCategory,
  type CategoryCount,
  type CategoryNode,
} from "#lib/categories";
import { m } from "#lib/i18n";

/** The category tree with rename, move, merge and delete actions. */
export function useCategories() {
  const [nodes, setNodes] = useState<CategoryNode[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setNodes(categoryTree(await api<CategoryCount[]>("/api/categories")));
    } catch (err) {
      toastError(m.categories_load_failed(), err, { id: "category" });
      setNodes((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const exists = (category: string) => !!nodes?.some((n) => n.category === category);

  /** Every action is a path change on the server: `from` (with its sub-categories) becomes `to`. */
  async function move(from: string, to: string, done: string, failed: string) {
    try {
      await api("/api/categories/rename", { json: { from, to } });
      toastSuccess(done, { description: `「${from}」→「${to}」`, id: "category" });
    } catch (err) {
      toastError(failed, err, { id: "category" });
    }
    refresh();
  }

  /** Renames just this level; the parent stays. */
  async function rename(node: CategoryNode) {
    const input = await Prompt.call({
      title: m.category_rename_title({ category: node.name }),
      defaultValue: node.name,
      confirmLabel: m.action_rename(),
    });
    const name = input?.trim();
    if (!name || name === node.name) return;
    if (name.includes("/")) return toastError(m.category_name_invalid(), undefined, { id: "category" });
    const to = joinCategory(parentCategory(node.category), name);
    if (exists(to)) return toastError(m.category_name_exists(), undefined, { id: "category" });
    await move(node.category, to, m.category_renamed(), m.category_rename_failed());
  }

  /** Whether `node` may move under `parent` ("" = top level): not into itself, not where it is. */
  const canMoveUnder = (node: CategoryNode, parent: string) =>
    !isWithinCategory(parent, node.category) && parent !== parentCategory(node.category);

  /** Puts the category (keeping its name) under `parent`; used by the picker and by dragging. */
  async function moveUnder(node: CategoryNode, parent: string) {
    if (!canMoveUnder(node, parent)) return;
    const to = joinCategory(parent, node.name);
    await move(node.category, to, exists(to) ? m.category_merged() : m.category_moved(), m.category_rename_failed());
  }

  /** Picks a new parent for the category (keeping its name), or the top level. */
  async function moveTo(node: CategoryNode) {
    const parent = await CategoryPickerDialog.call({
      title: m.category_move_title({ category: node.name }),
      description: m.category_move_hint(),
      nodes: nodes ?? [],
      allowTop: true,
      disabled: (c) => !canMoveUnder(node, c),
      confirmLabel: m.category_move(),
    });
    if (parent !== null) await moveUnder(node, parent);
  }

  /** Folds the category, with its sub-categories, into another one. */
  async function mergeInto(node: CategoryNode) {
    const target = await CategoryPickerDialog.call({
      title: m.category_merge_title({ category: node.name }),
      description: m.category_merge_hint(),
      nodes: nodes ?? [],
      disabled: (c) => isWithinCategory(c, node.category),
      confirmLabel: m.category_merge(),
    });
    if (!target) return;
    const ok = await Confirm.call({
      title: m.category_merge_confirm_title({ from: node.category, to: target }),
      message: m.category_merge_confirm_message({ count: node.total, to: target }),
      confirmLabel: m.category_merge(),
    });
    if (!ok) return;
    await move(node.category, target, m.category_merged(), m.category_rename_failed());
  }

  async function remove(node: CategoryNode) {
    const parent = parentCategory(node.category);
    const ok = await Confirm.call({
      title: m.category_delete_title({ category: node.category }),
      message: parent ? m.category_delete_message_parent({ parent }) : m.category_delete_message_top(),
      confirmLabel: m.action_delete(),
      danger: true,
    });
    if (!ok) return;
    try {
      await api("/api/categories/delete", { json: { category: node.category } });
      toastSuccess(m.category_deleted(), { description: node.category, id: "category" });
    } catch (err) {
      toastError(m.category_delete_failed(), err, { id: "category" });
    }
    refresh();
  }

  return { nodes, rename, moveTo, moveUnder, canMoveUnder, mergeInto, remove };
}
