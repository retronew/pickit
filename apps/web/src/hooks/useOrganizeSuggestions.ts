import { useEffect, useState } from "react";
import { api, errorMessage } from "#lib/api";

export interface SuggestionRow {
  id: number;
  name: string;
  url: string;
  category: string;
  tags: string[];
  suggested?: { category: string; tags: string[] };
  error?: string;
}

/** The API suggests at most 20 items per call; smaller chunks show progress sooner. */
const CHUNK = 10;
export const MAX_REVIEW = 100;

export function sameTags(a: string[], b: string[]) {
  return a.length === b.length && a.every((t) => b.includes(t));
}

/** Whether applying the suggestion would change anything. */
export function isChange(row: SuggestionRow): boolean {
  return (
    !!row.suggested &&
    (row.suggested.category !== row.category || !sameTags(row.suggested.tags, row.tags))
  );
}

/** Loads AI suggestions for up to 100 items, chunk by chunk. */
export function useOrganizeSuggestions(idsProp: number[]) {
  // The ids are fixed for the dialog's lifetime; keep the first ones so a new
  // array from a parent re-render doesn't restart loading.
  const [ids] = useState(idsProp);
  const [rows, setRows] = useState<SuggestionRow[]>([]);
  const [loaded, setLoaded] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const total = Math.min(ids.length, MAX_REVIEW);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const queue = ids.slice(0, MAX_REVIEW);
      for (let i = 0; i < queue.length && !cancelled; i += CHUNK) {
        const chunk = queue.slice(i, i + CHUNK);
        try {
          const { suggestions } = await api<{ suggestions: SuggestionRow[] }>("/api/items/suggest", {
            json: { ids: chunk },
          });
          if (cancelled) return;
          setRows((prev) => [...prev, ...suggestions]);
        } catch (err) {
          if (!cancelled) setError(errorMessage(err));
          break;
        } finally {
          if (!cancelled) setLoaded((n) => n + chunk.length);
        }
      }
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return { rows, loaded, total, error, done };
}
