import { useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "es-toolkit";
import type { Item } from "#hooks/useItems";

interface Hit extends Item {
  score: number;
}

export function useItemSearch() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const requestIdRef = useRef(0);

  const search = useMemo(
    () =>
      debounce(async (q: string) => {
        const requestId = ++requestIdRef.current;
        setSearching(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (requestId === requestIdRef.current) setHits(data.hits);
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
      setHits(null);
      return;
    }
    search(q);
  }, [query, search]);

  return { query, setQuery, hits, searching };
}
