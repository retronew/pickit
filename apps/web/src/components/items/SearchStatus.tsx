import { cn } from "#lib/utils";
import { m } from "#lib/i18n";

/** One-line status under the search box: searching, error or result count. */
export function SearchStatus({
  query,
  searching,
  error,
  hasHits,
  count,
}: {
  query: string;
  searching: boolean;
  error: string;
  hasHits: boolean;
  count: number;
}) {
  const q = query.trim();
  if (!q) return null;
  return (
    <p role="status" className={cn("-mt-2 text-xs", error ? "text-destructive" : "text-muted-foreground")}>
      {searching
        ? m.search_searching({ query: q })
        : error
          ? m.search_failed({ error })
          : hasHits
            ? m.search_found({ count })
            : null}
    </p>
  );
}
