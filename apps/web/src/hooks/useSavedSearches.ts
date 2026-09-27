import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SavedSearch } from "@pickit/shared";
import { api, toastError } from "#lib/api";
import { useLatestSave } from "#hooks/useLatestSave";
import { m } from "#lib/i18n";
import { savedSearchesQuery } from "#lib/queries";

const KEY = savedSearchesQuery.queryKey;

/**
 * Saved searches, stored server-side so they follow you across devices.
 * Changes apply optimistically; only the last of quick successive changes is
 * saved, and if that fails the list is reloaded from the server.
 */
export function useSavedSearches() {
  const queryClient = useQueryClient();
  const list = useQuery(savedSearchesQuery).data ?? [];
  // The latest list, so quick successive edits build on each other instead of
  // on the list from the last render.
  const current = () => queryClient.getQueryData(KEY) ?? [];
  const setList = (next: SavedSearch[]) => queryClient.setQueryData(KEY, next);

  const persist = useLatestSave(
    (next: SavedSearch[]) => api<SavedSearch[]>("/api/settings/saved-searches", { method: "PUT", json: next }),
    {
      onSuccess: setList,
      onError: (err) => {
        queryClient.invalidateQueries({ queryKey: KEY });
        toastError(m.saved_search_failed(), err, { id: "saved-search" });
      },
    },
  );

  function save(next: SavedSearch[]) {
    // A refetch landing now would undo the optimistic change.
    queryClient.cancelQueries({ queryKey: KEY });
    setList(next);
    persist(next);
  }

  return {
    list,
    add: (entry: Omit<SavedSearch, "id">) => save([...current(), { ...entry, id: crypto.randomUUID() }]),
    remove: (id: string) => save(current().filter((s) => s.id !== id)),
  };
}
