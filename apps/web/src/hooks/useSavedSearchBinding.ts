import type { SavedSearch } from "@pickit/shared";
import { useSavedSearches } from "#hooks/useSavedSearches";
import type { SortKey } from "#hooks/useItemFilters";
import { Prompt } from "#components/Prompt";
import { m } from "#lib/i18n";

/** The home page state a saved search captures. */
export interface SearchState {
  query: string;
  category: string;
  tags: string[];
  sort: SortKey;
}

const sameTags = (a: string[], b: string[]) => a.length === b.length && a.every((t) => b.includes(t));

export function matchesState(s: SavedSearch, state: SearchState): boolean {
  return (
    s.query === state.query.trim() &&
    s.category === state.category &&
    s.sort === state.sort &&
    sameTags(s.tags, state.tags)
  );
}

/**
 * Connects saved searches to the home page: which one is active, applying
 * one, and saving the current state under a name.
 */
export function useSavedSearchBinding(state: SearchState, apply: (s: SavedSearch) => void) {
  const saved = useSavedSearches();
  const active = saved.list.find((s) => matchesState(s, state)) ?? null;
  const canSave = !!state.query.trim() || !!state.category || state.tags.length > 0 || state.sort !== "pinned";

  async function saveCurrent() {
    // Suggest a name from what's set: the query, else the category / first tag.
    const suggestion = state.query.trim() || state.category || (state.tags[0] ? `#${state.tags[0]}` : "");
    const name = await Prompt.call({ title: m.saved_search_name_title(), defaultValue: suggestion });
    if (!name?.trim()) return;
    saved.add({ name: name.trim(), query: state.query.trim(), category: state.category, tags: state.tags, sort: state.sort });
  }

  return { list: saved.list, activeId: active?.id ?? null, canSave, apply, saveCurrent, remove: saved.remove };
}
