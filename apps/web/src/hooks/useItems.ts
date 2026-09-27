import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Item } from "@pickit/shared";
import { api, toastError } from "#lib/api";
import { m } from "#lib/i18n";
import { itemsQuery } from "#lib/items-query";
import { queryKeys } from "#lib/query-keys";

export type { Item };

/**
 * The full item list. The last copy is kept on disk, so a revisit shows it
 * right away while the fresh list loads in the background.
 */
export function useItems() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(itemsQuery);
  const items = data ?? [];

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.items }),
    [queryClient],
  );

  /** Saves a group's new manual order; shown right away, reloaded if saving fails. */
  const reorder = useCallback(
    async (ids: number[]) => {
      const position = new Map(ids.map((id, i) => [id, i]));
      queryClient.setQueryData<Item[]>(queryKeys.items, (prev) =>
        prev?.map((i) => (position.has(i.id) ? { ...i, position: position.get(i.id)! } : i)),
      );
      try {
        await api("/api/items/reorder", { json: { ids } });
      } catch (err) {
        toastError(m.reorder_failed(), err, { id: "reorder" });
        refresh();
      }
    },
    [queryClient, refresh],
  );

  return { items, loading: isPending, refresh, reorder };
}
