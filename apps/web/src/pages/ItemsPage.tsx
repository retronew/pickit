import { useCallback, useEffect, useState } from "react";
import { useItems, type Item } from "#hooks/useItems";
import { useItemSearch } from "#hooks/useItemSearch";
import { useItemFilters } from "#hooks/useItemFilters";
import { useItemActions } from "#hooks/useItemActions";
import { useBulkSelection } from "#hooks/useBulkSelection";
import { ItemFormDialog } from "#components/items/ItemFormDialog";
import { ItemSearchBar } from "#components/items/ItemSearchBar";
import { SearchStatus } from "#components/items/SearchStatus";
import { ItemsFilterBar } from "#components/items/ItemsFilterBar";
import { ItemGroups } from "#components/items/ItemGroups";
import { ItemDetailSheet } from "#components/items/ItemDetailSheet";
import { BulkActionBar } from "#components/items/BulkActionBar";
import { BatchAddDialog } from "#components/items/BatchAddDialog";
import { TagsEditDialog } from "#components/items/TagsEditDialog";
import { OrganizeReviewDialog } from "#components/items/OrganizeReviewDialog";
import { Confirm } from "#components/Confirm";
import { AskAi } from "#components/AskAi";
import { PageLoading } from "#components/PageLoading";
import { m } from "#lib/i18n";

/** Keeps the open detail sheet showing the latest copy of its item. */
function useDetailSheet(items: Item[]) {
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = useCallback((item: Item) => {
    setDetailItem(item);
    setDetailOpen(true);
  }, []);

  useEffect(() => {
    setDetailItem((current) => (current ? (items.find((i) => i.id === current.id) ?? current) : null));
  }, [items]);

  return { detailItem, detailOpen, setDetailOpen, openDetail };
}

export function ItemsPage() {
  const { items, loading, refresh } = useItems();
  const search = useItemSearch();
  const filters = useItemFilters(items, search.hits);
  const detail = useDetailSheet(items);
  const selection = useBulkSelection(refresh, items, filters.allTags);
  const [batchOpen, setBatchOpen] = useState(false);

  const { detailItem, setDetailOpen } = detail;
  const onDeleted = useCallback(
    (item: Item) => {
      if (detailItem?.id === item.id) setDetailOpen(false);
    },
    [detailItem, setDetailOpen],
  );
  const actions = useItemActions({
    refresh,
    categories: filters.categories,
    allTags: filters.allTags,
    onDeleted,
  });

  return (
    <div className="space-y-5 pb-28">
      <ItemSearchBar
        query={search.query}
        onQueryChange={search.setQuery}
        searching={search.searching}
        onAdd={actions.addItem}
        onBatchAdd={() => setBatchOpen(true)}
      />
      <SearchStatus
        query={search.query}
        searching={search.searching}
        error={search.error}
        hasHits={!!search.hits}
        count={filters.visibleItems.length}
      />

      <ItemsFilterBar
        categoryOptions={filters.categoryOptions}
        category={filters.category}
        onCategoryChange={filters.setCategory}
        tagOptions={filters.tagOptions}
        selectedTags={filters.selectedTags}
        onTagsChange={filters.setTagFilter}
        onClearFilters={filters.clearFilters}
        sortKey={filters.sortKey}
        onSortChange={filters.setSortKey}
        selectMode={selection.selectMode}
        onToggleSelectMode={selection.selectMode ? selection.exitSelectMode : selection.startSelect}
      />

      {!loading && (
        <p className="text-xs text-muted-foreground">{m.items_total({ count: filters.visibleItems.length })}</p>
      )}

      {selection.selectMode && selection.selectedIds.size > 0 && (
        <BulkActionBar
          count={selection.selectedIds.size}
          categories={filters.categories}
          onPin={() => selection.bulkAction("pin")}
          onUnpin={() => selection.bulkAction("unpin")}
          onMoveCategory={(c) => selection.bulkAction("category", c)}
          onDelete={selection.bulkDelete}
          onEditTags={selection.editTags}
          onAiOrganize={selection.aiOrganize}
          onCancel={selection.exitSelectMode}
        />
      )}

      {loading ? (
        <PageLoading />
      ) : (
        <ItemGroups
          grouped={filters.grouped}
          filtered={!!search.query || filters.hasFilters}
          dimmed={search.searching}
          selectMode={selection.selectMode}
          selectedIds={selection.selectedIds}
          onToggleSelect={selection.toggleSelect}
          onEdit={actions.editItem}
          onDelete={actions.deleteItem}
          onTogglePin={actions.togglePin}
          onOpenDetail={detail.openDetail}
        />
      )}

      <AskAi />
      <ItemFormDialog />
      <TagsEditDialog />
      <OrganizeReviewDialog />
      <Confirm />
      <BatchAddDialog open={batchOpen} onOpenChange={setBatchOpen} onDone={refresh} />
      <ItemDetailSheet
        item={detailItem}
        open={detail.detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={() => detailItem && actions.editItem(detailItem)}
        onDelete={() => detailItem && actions.deleteItem(detailItem)}
        onTogglePin={() => detailItem && actions.togglePin(detailItem)}
        onChanged={refresh}
        onOpenRelated={detail.openDetail}
      />
    </div>
  );
}
