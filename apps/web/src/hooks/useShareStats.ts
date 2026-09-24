import { useEffect, useState } from "react";
import { api } from "#lib/api";

export interface ShareStats {
  total: number;
  lastViewedAt: number | null;
  last30: number;
  byDay: { day: string; page: number; rss: number }[];
  referrers: { host: string; count: number }[];
  countries: { country: string; count: number }[];
  recent: { at: number; kind: "page" | "rss"; referrer: string; country: string }[];
}

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
