import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { del, get, set } from "idb-keyval";

const STORAGE_KEY = "pickit-query-cache";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Kept long enough to survive being written to and restored from disk.
      gcTime: 7 * 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Cached queries go to IndexedDB rather than localStorage: a large
 * collection can outgrow localStorage's ~5 MB.
 */
export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key).then((v) => v ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  key: STORAGE_KEY,
});

export const persistOptions = {
  persister: queryPersister,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  // Bump when a persisted response changes shape, so old caches are dropped.
  buster: "1",
  dehydrateOptions: {
    // Only queries that opt in are written to disk.
    shouldDehydrateQuery: (query: { meta?: Record<string, unknown>; state: { status: string } }) =>
      query.meta?.persist === true && query.state.status === "success",
  },
};

/** Forgets every cached response, in memory and on disk (e.g. on sign-out). */
export async function clearQueryCache() {
  queryClient.clear();
  await queryPersister.removeClient();
}
