import { useEffect, useState } from "react";
import type { ShareStats, ShareVisit } from "@pickit/shared";
import { api } from "#lib/api";

export type { ShareStats, ShareVisit };

/** Visit stats of one share; `error` is set when they couldn't be loaded. */
export function useShareStats(slug: string) {
  const [stats, setStats] = useState<ShareStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<ShareStats>(`/api/shares/${slug}/stats`)
      .then((s) => !cancelled && setStats(s))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { stats, error };
}
