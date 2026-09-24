import { useCallback, useEffect, useState } from "react";
import type { Item } from "@pickit/shared";
import { api, toastError } from "#lib/api";
import { m } from "#lib/i18n";

export type { Item };

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    () =>
      fetch("/api/items")
        .then((r) => r.json())
        .then(setItems)
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Saves a group's new manual order; shown right away, reloaded if saving fails. */
  const reorder = useCallback(
    async (ids: number[]) => {
      const position = new Map(ids.map((id, i) => [id, i]));
      setItems((prev) => prev.map((i) => (position.has(i.id) ? { ...i, position: position.get(i.id)! } : i)));
      try {
        await api("/api/items/reorder", { json: { ids } });
      } catch (err) {
        toastError(m.reorder_failed(), err, { id: "reorder" });
        refresh();
      }
    },
    [refresh],
  );

  return { items, loading, refresh, reorder };
}
