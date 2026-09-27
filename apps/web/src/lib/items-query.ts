import { queryOptions } from "@tanstack/react-query";
import type { Item } from "@pickit/shared";
import { api } from "#lib/api";
import { queryKeys } from "#lib/query-keys";

/** The full item list, persisted to disk (see query-client.ts). */
export const itemsQuery = queryOptions({
  queryKey: queryKeys.items,
  queryFn: () => api<Item[]>("/api/items"),
  meta: { persist: true },
});
