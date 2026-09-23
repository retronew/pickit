import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { uniq, sortBy } from "es-toolkit";
import { ArrowUpDownIcon, CheckSquareIcon, XIcon } from "lucide-react";
import { useItems, type Item } from "#hooks/useItems";
import { useItemSearch } from "#hooks/useItemSearch";
import { groupByCategory } from "#lib/groupItems";
import { cn } from "#lib/utils";
import { ItemFormDialog } from "#components/ItemFormDialog";
import { api, toastError, toastSuccess } from "#lib/api";
import { saveItem } from "#lib/items";
import { Confirm } from "#components/Confirm";
import { ItemSearchBar } from "#components/ItemSearchBar";
import { CategoryFilter, type CategoryOption } from "#components/CategoryFilter";
import { TagFilter, type TagOption } from "#components/TagFilter";
import { ItemCard } from "#components/ItemCard";
import { ItemDetailSheet } from "#components/ItemDetailSheet";
import { BulkActionBar } from "#components/BulkActionBar";
import { BatchAddDialog } from "#components/BatchAddDialog";
import { AskAi } from "#components/AskAi";
import { Button } from "#components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "#components/ui/select";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "#components/ui/empty";
import { PageLoading } from "#components/PageLoading";

type SortKey = "pinned" | "created" | "updated" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  pinned: "默认排序",
  created: "最近添加",
  updated: "最近更新",
  name: "按名称",
};

export function ItemsPage() {
  const { items, loading, refresh } = useItems();
  const { query, setQuery, hits, searching, error: searchError } = useItemSearch();
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState("");
  const selectedTags = useMemo(() => uniq(searchParams.getAll("tag")), [searchParams]);
  const [sortKey, setSortKey] = useState<SortKey>("pinned");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  function setTagFilter(next: string[]) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete("tag");
      for (const tag of next) params.append("tag", tag);
      return params;
    }, { replace: true });
  }

  const openDetail = useCallback((item: Item) => {
    setDetailItem(item);
    setDetailOpen(true);
  }, []);

  useEffect(() => {
    if (!detailItem) return;
    const updated = items.find((i) => i.id === detailItem.id);
    if (updated) setDetailItem(updated);
    // Only re-sync when the underlying items list changes, not on every
    // detailItem identity change (that would loop: set → effect → set…).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const categories = useMemo(
    () => uniq(items.map((i) => i.category).filter(Boolean)).sort(),
    [items],
  );

  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!item.category) continue;
      const parts = item.category.split("/");
      for (let depth = 1; depth <= parts.length; depth++) {
        const value = parts.slice(0, depth).join("/");
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([value, count]) => ({ value, count }));
  }, [items]);

  const tagOptions = useMemo<TagOption[]>(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const value of new Set(item.tags)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([value, count]) => ({ value, count }));
  }, [items]);

  const allTags = useMemo(() => tagOptions.map((option) => option.value), [tagOptions]);

  const filtered = useMemo(() => {
    let list = items;
    if (category) {
      list = list.filter(
        (i) => i.category === category || i.category.startsWith(`${category}/`),
      );
    }
    if (selectedTags.length > 0) {
      list = list.filter((item) => selectedTags.every((tag) => item.tags.includes(tag)));
    }
    return list;
  }, [items, category, selectedTags]);

  const sorted = useMemo(() => {
    if (sortKey === "pinned") return filtered;
    const [pinned, rest] = [
      filtered.filter((i) => i.pinned),
      filtered.filter((i) => !i.pinned),
    ];
    const byKey =
      sortKey === "created"
        ? (list: Item[]) => sortBy(list, [(i) => -i.createdAt])
        : sortKey === "updated"
          ? (list: Item[]) => sortBy(list, [(i) => -i.updatedAt])
          : (list: Item[]) => sortBy(list, [(i) => i.name.toLowerCase()]);
    return [...byKey(pinned), ...byKey(rest)];
  }, [filtered, sortKey]);

  const visibleItems = useMemo(() => {
    if (!hits) return sorted;
    return hits.filter((item) =>
      (!category || item.category === category || item.category.startsWith(`${category}/`)) &&
      selectedTags.every((tag) => item.tags.includes(tag)),
    );
  }, [hits, sorted, category, selectedTags]);

  const grouped = useMemo(() => groupByCategory(visibleItems), [visibleItems]);

  async function addItem() {
    const payload = await ItemFormDialog.call({
      item: null,
      categories,
      allTags,
      onSubmit: (p) => saveItem(p, null),
    });
    if (payload) refresh();
  }

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

  const togglePin = useCallback(async (item: Item) => {
    try {
      await api(`/api/items/${item.id}`, { method: "PUT", json: { pinned: !item.pinned } });
      toastSuccess(item.pinned ? "已取消置顶" : "已置顶", { description: item.name, id: "item-pin" });
      refresh();
    } catch (err) {
      toastError(item.pinned ? "取消置顶失败" : "置顶失败", err, { id: "item-pin" });
    }
  }, [refresh]);

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
      if (detailItem?.id === item.id) setDetailOpen(false);
      refresh();
      toastSuccess("已移到回收站", {
        description: item.name,
        id: "item-delete",
        action: {
          label: "撤销",
          onClick: () =>
            api(`/api/items/${item.id}/restore`, { method: "POST" })
              .then(() => {
                toastSuccess("已恢复", { description: item.name, id: "item-delete" });
                refresh();
              })
              .catch((err) => toastError("恢复失败", err, { id: "item-delete" })),
        },
      });
    },
    [detailItem, refresh],
  );

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

  async function bulkAction(
    action: "delete" | "pin" | "unpin" | "category",
    value?: string,
  ) {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
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

  async function bulkDelete() {
    const ok = await Confirm.call({
      title: `删除选中的 ${selectedIds.size} 项？`,
      message: "删除后会放进回收站，随时可以恢复。",
      confirmLabel: "删除",
      danger: true,
    });
    if (!ok) return;
    await bulkAction("delete");
  }

  return (
    <div className="space-y-5 pb-28">
      <ItemSearchBar
        query={query}
        onQueryChange={setQuery}
        searching={searching}
        onAdd={addItem}
        onBatchAdd={() => setBatchOpen(true)}
      />
      {query.trim() && (
        <p
          role="status"
          className={cn("-mt-2 text-xs", searchError ? "text-destructive" : "text-muted-foreground")}
        >
          {searching
            ? `正在搜索「${query.trim()}」…`
            : searchError
              ? `搜索失败：${searchError}`
              : hits
                ? `找到 ${visibleItems.length} 条相关收藏，按相关度排序`
                : null}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {categoryOptions.length > 0 && (
            <CategoryFilter options={categoryOptions} category={category} onChange={setCategory} />
          )}
          {tagOptions.length > 0 && (
            <TagFilter options={tagOptions} selected={selectedTags} onChange={setTagFilter} />
          )}
          <div className="ml-auto flex items-center gap-2">
            <Select
              value={sortKey}
              onValueChange={(v) => setSortKey(v as SortKey)}
              items={SORT_LABELS}
            >
              <SelectTrigger size="sm" className="w-auto min-w-0 bg-background">
                <ArrowUpDownIcon className="size-3.5 opacity-60" />
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <Button
              variant={selectMode ? "default" : "secondary"}
              size="sm"
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            >
              <CheckSquareIcon />
              选择
            </Button>
          </div>
        </div>

        {(category || selectedTags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">已筛选</span>
            {category && (
              <Button size="xs" variant="secondary" onClick={() => setCategory("")}>
                {category}<XIcon className="size-3" />
              </Button>
            )}
            {selectedTags.map((tag) => (
              <Button
                key={tag}
                size="xs"
                variant="secondary"
                onClick={() => setTagFilter(selectedTags.filter((value) => value !== tag))}
              >
                #{tag}<XIcon className="size-3" />
              </Button>
            ))}
            <button
              className="px-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => { setCategory(""); setTagFilter([]); }}
              type="button"
            >
              清除全部
            </button>
          </div>
        )}
      </div>

      {!loading && (
        <p className="text-xs text-muted-foreground">共 {visibleItems.length} 条收藏</p>
      )}

      {selectMode && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          categories={categories}
          onPin={() => bulkAction("pin")}
          onUnpin={() => bulkAction("unpin")}
          onMoveCategory={(c) => bulkAction("category", c)}
          onDelete={bulkDelete}
          onCancel={exitSelectMode}
        />
      )}

      {loading ? (
        <PageLoading />
      ) : grouped.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>
              {query || category || selectedTags.length ? "没有符合条件的收藏" : "还没有收藏"}
            </EmptyTitle>
            <EmptyDescription>
              {query || category || selectedTags.length
                ? "试试其他关键词，或清除筛选条件。"
                : "点右上角「添加」；也可以粘贴一批网址批量导入。"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className={cn("animate-fade-in space-y-5 transition-opacity", searching && "opacity-60")}>
        {grouped.map(([cat, list]) => (
          <section key={cat}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {cat} · {list.length}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onEdit={editItem}
                  onDelete={deleteItem}
                  onTogglePin={togglePin}
                  onOpenDetail={openDetail}
                  selectMode={selectMode}
                  selected={selectedIds.has(item.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          </section>
        ))}
        </div>
      )}

      <AskAi />
      <ItemFormDialog />
      <Confirm />
      <BatchAddDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        onDone={refresh}
      />
      <ItemDetailSheet
        item={detailItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={() => detailItem && editItem(detailItem)}
        onDelete={() => detailItem && deleteItem(detailItem)}
        onTogglePin={() => detailItem && togglePin(detailItem)}
        onChanged={refresh}
        onOpenRelated={openDetail}
      />
    </div>
  );
}
