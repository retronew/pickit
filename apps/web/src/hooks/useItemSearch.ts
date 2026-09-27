import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { errorMessage } from "#lib/api";
import { searchQuery } from "#lib/queries";

const DEBOUNCE_MS = 300;

export function useItemSearch() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const q = query.trim();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  const result = useQuery({
    ...searchQuery(debounced),
    enabled: !!debounced,
    // Keeps the last hits on screen (dimmed) while the next search runs.
    placeholderData: keepPreviousData,
  });

  if (!q) return { query, setQuery, hits: null, searching: false, error: "" };
  return {
    query,
    setQuery,
    hits: result.data?.hits ?? null,
    // Searching starts now, not after the debounce, so feedback is immediate.
    searching: q !== debounced || result.isFetching,
    error: result.isError && q === debounced ? errorMessage(result.error) : "",
  };
}
