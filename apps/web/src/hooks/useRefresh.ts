import { useCallback } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

/** Refetches every cached query under `key` (and marks it stale for later visits). */
export function useRefresh(key: QueryKey) {
  const queryClient = useQueryClient();
  const serialized = JSON.stringify(key);
  return useCallback(() => queryClient.invalidateQueries({ queryKey: key }), [queryClient, serialized]);
}
