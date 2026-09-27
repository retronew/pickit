import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";
import { githubTokenQuery, githubTokenStatusQuery } from "#lib/queries";

export interface GithubTokenInfo {
  masked: string | null;
  /** No token saved here, but the GITHUB_TOKEN secret is set. */
  fromSecret: boolean;
}

/** Live check of the token in use, straight from GitHub. */
export type GithubTokenStatus =
  | { configured: false }
  | { configured: true; reachable: false }
  | {
      configured: true;
      reachable: true;
      valid: boolean;
      limit?: number;
      remaining?: number;
      resetAt?: number;
      /** null: the token never expires. */
      expiresAt?: number | null;
    };

/** The GitHub token on the settings page: what's saved, its live status, save / check / remove. */
export function useGithubToken() {
  const queryClient = useQueryClient();
  const infoQuery = useQuery(githubTokenQuery);
  const info: GithubTokenInfo | null =
    infoQuery.data ?? (infoQuery.isError ? { masked: null, fromSecret: false } : null);
  const hasToken = !!(info?.masked || info?.fromSecret);
  const statusQuery = useQuery({ ...githubTokenStatusQuery, enabled: hasToken });
  const status: GithubTokenStatus | null = !info ? null : hasToken ? (statusQuery.data ?? null) : { configured: false };
  const checking = statusQuery.isFetching;
  const [saving, setSaving] = useState(false);

  const check = () => statusQuery.refetch();
  // Refetches the token info and, through the prefix, its live status.
  const refresh = () => queryClient.invalidateQueries({ queryKey: githubTokenQuery.queryKey });

  /** Verifies the token with GitHub and saves it; resolves to true when saved. */
  async function save(token: string): Promise<boolean> {
    setSaving(true);
    try {
      const res = await api<{ limit: number }>("/api/settings/github-token", { method: "PUT", json: { token } });
      toastSuccess(m.github_token_saved({ limit: res.limit }), { id: "github-token" });
      await refresh();
      return true;
    } catch (err) {
      toastError(m.github_token_save_failed(), err, { id: "github-token" });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api("/api/settings/github-token", { method: "DELETE" });
      await refresh();
    } catch (err) {
      toastError(m.github_token_save_failed(), err, { id: "github-token" });
    }
  }

  return { info, status, checking, saving, check, save, remove };
}
