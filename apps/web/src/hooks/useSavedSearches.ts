import { useEffect, useRef, useState } from "react";
import type { SavedSearch } from "@pickit/shared";
import { api, toastError } from "#lib/api";
import { useLatestSave } from "#hooks/useLatestSave";
import { m } from "#lib/i18n";

/**
 * Saved searches, stored server-side so they follow you across devices.
 * Changes apply optimistically; only the last of quick successive changes is
 * saved, and if that fails the list rolls back to what the server last confirmed.
 */
export function useSavedSearches() {
  const [list, setListState] = useState<SavedSearch[]>([]);
  // The latest list, so quick successive edits build on each other instead of
  // on the list from the last render.
  const listRef = useRef(list);
  // What the server last confirmed, to roll back to.
  const confirmedRef = useRef(list);
  const setList = (next: SavedSearch[]) => {
    listRef.current = next;
    setListState(next);
  };
  const confirm = (next: SavedSearch[]) => {
    confirmedRef.current = next;
    setList(next);
  };

  useEffect(() => {
    api<SavedSearch[]>("/api/settings/saved-searches")
      .then(confirm)
      .catch(() => {});
  }, []);

  const persist = useLatestSave(
    (next: SavedSearch[]) => api<SavedSearch[]>("/api/settings/saved-searches", { method: "PUT", json: next }),
    {
      onSuccess: confirm,
      onError: (err) => {
        setList(confirmedRef.current);
        toastError(m.saved_search_failed(), err, { id: "saved-search" });
      },
    },
  );

  function save(next: SavedSearch[]) {
    setList(next);
    persist(next);
  }

  return {
    list,
    add: (entry: Omit<SavedSearch, "id">) => save([...listRef.current, { ...entry, id: crypto.randomUUID() }]),
    remove: (id: string) => save(listRef.current.filter((s) => s.id !== id)),
  };
}
