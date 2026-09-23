import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "#lib/api";
import type { AuditEntry } from "#lib/audit";

export interface AuditFilters {
  category: string;
  action: string;
  actor: string;
  result: "" | "ok" | "error";
  q: string;
  /** yyyy-mm-dd, local time */
  from: string;
  to: string;
}

export const EMPTY_FILTERS: AuditFilters = {
  category: "",
  action: "",
  actor: "",
  result: "",
  q: "",
  from: "",
  to: "",
};

const PAGE_SIZE = 50;
const LIVE_INTERVAL_MS = 5000;

function toParams(f: AuditFilters, extra: Record<string, string | number> = {}) {
  const p = new URLSearchParams();
  for (const key of ["category", "action", "actor", "result", "q"] as const) {
    if (f[key]) p.set(key, f[key]);
  }
  if (f.from) p.set("from", String(new Date(`${f.from}T00:00:00`).getTime()));
  // A range with only a start day means that single day.
  const to = f.to || f.from;
  if (to) p.set("to", String(new Date(`${to}T23:59:59.999`).getTime()));
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
  return p.toString();
}

interface Page {
  entries: AuditEntry[];
  hasMore: boolean;
}

/**
 * Filtered audit entries, newest first. `live` polls for entries newer than
 * the top one; polling pauses while the tab is hidden.
 */
export function useAuditLog(filters: AuditFilters, live: boolean) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  // Only full reloads (not live polls), for things that are costly to refetch.
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const topIdRef = useRef(0);
  // Drops responses for filters that are no longer current.
  const generationRef = useRef(0);

  const reload = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true);
    try {
      const page = await api<Page>(`/api/audit?${toParams(filters, { limit: PAGE_SIZE })}`);
      if (generation !== generationRef.current) return;
      setEntries(page.entries);
      setHasMore(page.hasMore);
      setFreshIds(new Set());
      topIdRef.current = page.entries[0]?.id ?? 0;
      setError("");
      setUpdatedAt(Date.now());
      setLoadedAt(Date.now());
    } catch (err) {
      if (generation === generationRef.current) setError(errorMessage(err));
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [filters]);

  const loadMore = useCallback(async () => {
    const last = entries.at(-1);
    if (!last) return;
    setLoadingMore(true);
    try {
      const page = await api<Page>(
        `/api/audit?${toParams(filters, { limit: PAGE_SIZE, before: last.id })}`,
      );
      setEntries((prev) => [...prev, ...page.entries]);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }, [entries, filters]);

  const pollNewer = useCallback(async () => {
    const generation = generationRef.current;
    try {
      const page = await api<Page>(
        `/api/audit?${toParams(filters, { limit: 200, after: topIdRef.current })}`,
      );
      if (generation !== generationRef.current) return;
      setUpdatedAt(Date.now());
      setError("");
      if (!page.entries.length) return;
      topIdRef.current = page.entries[0].id;
      setEntries((prev) => [...page.entries, ...prev]);
      setFreshIds(new Set(page.entries.map((e) => e.id)));
    } catch (err) {
      if (generation === generationRef.current) setError(errorMessage(err));
    }
  }, [filters]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") pollNewer();
    }, LIVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [live, pollNewer]);

  return {
    entries,
    hasMore,
    loading,
    loadingMore,
    error,
    freshIds,
    updatedAt,
    loadedAt,
    reload,
    loadMore,
  };
}
