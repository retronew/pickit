import { useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "es-toolkit";
import type { Item } from "#hooks/useItems";
import { api, errorMessage } from "#lib/api";

interface Hit extends Item {
  score: number;
}

export function useItemSearch() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const search = useMemo(
    () =>
      debounce(async (q: string) => {
        const requestId = ++requestIdRef.current;
        try {
          const data = await api<{ hits: Hit[] }>(`/api/search?q=${encodeURIComponent(q)}`);
          if (requestId === requestIdRef.current) {
            setHits(data.hits);
            setError("");
          }
        } catch (err) {
          if (requestId === requestIdRef.current) setError(errorMessage(err));
        } finally {
          if (requestId === requestIdRef.current) setSearching(false);
        }
      }, 300),
    [],
  );

  useEffect(() => () => search.cancel(), [search]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      search.cancel();
      requestIdRef.current++;
      setHits(null);
      setSearching(false);
      setError("");
      return;
    }
    // Searching starts now, not after the debounce, so feedback is immediate.
    setSearching(true);
    search(q);
  }, [query, search]);

  return { query, setQuery, hits, searching, error };
}
