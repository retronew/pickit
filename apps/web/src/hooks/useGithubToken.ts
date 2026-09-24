import { useCallback, useEffect, useState } from "react";
import { api, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

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
  const [info, setInfo] = useState<GithubTokenInfo | null>(null);
  const [status, setStatus] = useState<GithubTokenStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await api<GithubTokenStatus>("/api/settings/github-token/status"));
    } catch {
      setStatus({ configured: true, reachable: false });
    } finally {
      setChecking(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const next = await api<GithubTokenInfo>("/api/settings/github-token").catch(() => ({
      masked: null,
      fromSecret: false,
    }));
    setInfo(next);
    if (next.masked || next.fromSecret) await check();
    else setStatus({ configured: false });
  }, [check]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
