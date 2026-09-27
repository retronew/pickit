import { useQuery } from "@tanstack/react-query";
import type { ShareStats, ShareVisit } from "@pickit/shared";
import { shareStatsQuery } from "#lib/queries";

export type { ShareStats, ShareVisit };

/** Visit stats of one share; `error` is set when they couldn't be loaded. */
export function useShareStats(slug: string) {
  const { data, isError } = useQuery(shareStatsQuery(slug));
  return { stats: data ?? null, error: isError };
}
