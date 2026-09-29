// Every server read the app caches, as TanStack Query options. Hooks and
// pages read through these, and invalidate by the same keys after a write.
// `meta.persist` also keeps the last copy on disk (see query-client.ts), so a
// revisit shows it right away; only lists, never secrets or settings.

import { queryOptions } from "@tanstack/react-query";
import type { BrowserRenderInfo, CronOverview, Item, SavedSearch, ShareStats } from "@pickit/shared";
import { api } from "#lib/api";
import type { Locale } from "#lib/i18n";
import type { CategoryCount } from "#lib/categories";
import type { Share } from "#lib/shares";
import type { Webhook } from "#lib/webhooks";
import type { BackupInfo } from "#hooks/useBackups";
import type { GithubTokenInfo, GithubTokenStatus } from "#hooks/useGithubToken";
import type { ItemContent } from "#hooks/useItemContent";

export interface TagRow {
  tag: string;
  count: number;
}

export interface Stats {
  total: number;
  byCategory: { category: string; count: number }[];
  byMonth: { month: string; count: number }[];
  clickTop: { id: number; name: string; clickCount: number }[];
  embeddingCoverage: number;
  deadLinks: number;
  trash: number;
}

const persist = { persist: true };

export const itemsQuery = queryOptions({
  queryKey: ["items"],
  queryFn: () => api<Item[]>("/api/items"),
  meta: persist,
});

export const trashQuery = queryOptions({
  queryKey: ["items", "trash"],
  queryFn: () => api<Item[]>("/api/items/trash"),
  meta: persist,
});

export const statsQuery = queryOptions({
  queryKey: ["items", "stats"],
  queryFn: () => api<Stats>("/api/items/stats"),
  meta: persist,
});

export const itemCategoryNamesQuery = queryOptions({
  queryKey: ["items", "categories"],
  queryFn: () => api<string[]>("/api/items/categories"),
});

export const itemContentQuery = (id: number) =>
  queryOptions({
    queryKey: ["items", id, "content"],
    queryFn: () => api<ItemContent>(`/api/items/${id}/content`),
  });

export const relatedQuery = (id: number) =>
  queryOptions({
    queryKey: ["items", id, "related"],
    queryFn: () => api<Item[]>(`/api/items/${id}/related?limit=6`),
  });

export const searchQuery = (q: string, semantic = true) =>
  queryOptions({
    queryKey: ["search", q, semantic],
    queryFn: () =>
      api<{ hits: (Item & { score: number })[] }>(
        `/api/search?q=${encodeURIComponent(q)}${semantic ? "" : "&semantic=0"}`,
      ),
    staleTime: 60_000,
  });

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: () => api<CategoryCount[]>("/api/categories"),
  meta: persist,
});

export const tagsQuery = queryOptions({
  queryKey: ["tags"],
  queryFn: () => api<TagRow[]>("/api/tags"),
  meta: persist,
});

export const sharesQuery = queryOptions({
  queryKey: ["shares"],
  queryFn: () => api<Share[]>("/api/shares"),
  meta: persist,
});

export const shareStatsQuery = (slug: string) =>
  queryOptions({
    queryKey: ["shares", slug, "stats"],
    queryFn: () => api<ShareStats>(`/api/shares/${slug}/stats`),
  });

export const savedSearchesQuery = queryOptions({
  queryKey: ["saved-searches"],
  queryFn: () => api<SavedSearch[]>("/api/settings/saved-searches"),
  meta: persist,
});

export const webhooksQuery = queryOptions({
  queryKey: ["webhooks"],
  queryFn: () => api<Webhook[]>("/api/webhooks"),
});

export const cronQuery = queryOptions({
  queryKey: ["cron"],
  queryFn: () => api<CronOverview>("/api/cron"),
});

export const browserRenderQuery = queryOptions({
  queryKey: ["browser-render"],
  queryFn: () => api<BrowserRenderInfo>("/api/settings/browser-render"),
});

export const backupsQuery = queryOptions({
  queryKey: ["backups"],
  queryFn: () => api<{ configured: boolean; backups: BackupInfo[] }>("/api/backups"),
});

export const githubTokenQuery = queryOptions({
  queryKey: ["github-token"],
  queryFn: () => api<GithubTokenInfo>("/api/settings/github-token"),
});

/** Asks GitHub itself, so it's only refetched on purpose ("Check"). */
export const githubTokenStatusQuery = queryOptions({
  queryKey: ["github-token", "status"],
  queryFn: () =>
    api<GithubTokenStatus>("/api/settings/github-token/status").catch(
      (): GithubTokenStatus => ({ configured: true, reachable: false }),
    ),
});

export const apiTokenQuery = queryOptions({
  queryKey: ["api-token"],
  queryFn: () => api<{ configured: boolean; masked: string | null }>("/api/settings/api-token"),
});

export const allowedEmailsQuery = queryOptions({
  queryKey: ["allowed-emails"],
  queryFn: () => api<{ owners: string[]; emails: string[] }>("/api/settings/allowed-emails"),
});

export const localePrefsQuery = queryOptions({
  queryKey: ["locale-prefs"],
  queryFn: () => api<{ aiLanguage: Locale | "auto" }>("/api/settings/locale"),
});
