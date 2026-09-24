import { ArrowUpDownIcon, CheckSquareIcon, Share2Icon, XIcon } from "lucide-react";
import { shareAndCopy } from "#lib/shares";
import { Button } from "#components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "#components/ui/select";
import { CategoryFilter, type CategoryOption } from "#components/items/CategoryFilter";
import { TagFilter, type TagOption } from "#components/items/TagFilter";
import { SORT_LABELS, type SortKey } from "#hooks/useItemFilters";
import { m } from "#lib/i18n";

interface Props {
  categoryOptions: CategoryOption[];
  category: string;
  onCategoryChange: (category: string) => void;
  tagOptions: TagOption[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  onClearFilters: () => void;
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
  selectMode: boolean;
  onToggleSelectMode: () => void;
}

/** A category alone or a single tag alone can be shared as a public list. */
function shareTarget(category: string, tags: string[]) {
  if (category && tags.length === 0) return { type: "category" as const, value: category, label: m.share_this_category() };
  if (!category && tags.length === 1) return { type: "tag" as const, value: tags[0], label: m.share_this_tag() };
  return null;
}

/** Category / tag filters, sort order, select mode and the active filter chips. */
export function ItemsFilterBar(p: Props) {
  const share = shareTarget(p.category, p.selectedTags);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 sm:flex-wrap">
        {p.categoryOptions.length > 0 && (
          <CategoryFilter options={p.categoryOptions} category={p.category} onChange={p.onCategoryChange} />
        )}
        {p.tagOptions.length > 0 && (
          <TagFilter options={p.tagOptions} selected={p.selectedTags} onChange={p.onTagsChange} />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Select
            value={p.sortKey}
            onValueChange={(v) => p.onSortChange(v as SortKey)}
            items={SORT_LABELS}
          >
            <SelectTrigger size="sm" aria-label={m.sort_label()} className="w-auto min-w-0 bg-background max-sm:[&_[data-slot=select-value]]:sr-only max-sm:[&_[data-slot=select-icon]]:hidden">
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
            variant={p.selectMode ? "default" : "secondary"}
            size="sm"
            onClick={p.onToggleSelectMode}
          >
            <CheckSquareIcon />
            <span className="max-sm:sr-only">{m.action_select()}</span>
          </Button>
        </div>
      </div>

      {(p.category || p.selectedTags.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">{m.filter_active()}</span>
          {p.category && (
            <Button size="xs" variant="secondary" onClick={() => p.onCategoryChange("")}>
              {p.category}
              <XIcon className="size-3" />
            </Button>
          )}
          {p.selectedTags.map((tag) => (
            <Button
              key={tag}
              size="xs"
              variant="secondary"
              onClick={() => p.onTagsChange(p.selectedTags.filter((value) => value !== tag))}
            >
              #{tag}
              <XIcon className="size-3" />
            </Button>
          ))}
          <button
            className="px-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={p.onClearFilters}
            type="button"
          >
            {m.filter_clear_all()}
          </button>
          {share && (
            <Button
              size="xs"
              variant="ghost"
              className="ml-auto text-muted-foreground"
              onClick={() => shareAndCopy(share.type, share.value)}
            >
              <Share2Icon />
              {share.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
