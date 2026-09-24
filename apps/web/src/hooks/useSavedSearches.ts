import { useEffect, useState } from "react";
import type { SavedSearch } from "@pickit/shared";
import { api, toastError } from "#lib/api";
import { m } from "#lib/i18n";

/**
 * Saved searches, stored server-side so they follow you across devices.
 * Changes apply optimistically and roll back if saving fails.
 */
export function useSavedSearches() {
  const [list, setList] = useState<SavedSearch[]>([]);

  useEffect(() => {
    api<SavedSearch[]>("/api/settings/saved-searches")
      .then(setList)
      .catch(() => {});
  }, []);

  async function save(next: SavedSearch[]) {
    const previous = list;
    setList(next);
    try {
      setList(await api<SavedSearch[]>("/api/settings/saved-searches", { method: "PUT", json: next }));
    } catch (err) {
      setList(previous);
      toastError(m.saved_search_failed(), err, { id: "saved-search" });
    }
  }

  return {
    list,
    add: (entry: Omit<SavedSearch, "id">) => save([...list, { ...entry, id: crypto.randomUUID() }]),
    remove: (id: string) => save(list.filter((s) => s.id !== id)),
  };
}
