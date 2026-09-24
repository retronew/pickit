import { useCallback, useEffect, useState } from "react";
import type { SharedItem } from "#components/share/SharedItemCard";
import { api, ApiError } from "#lib/api";

export type Shared =
  | { type: "item"; title: string; item: SharedItem }
  | { type: "category" | "tag" | "mix" | "collection"; title: string; value: string; items: SharedItem[] };

export type PublicShareState =
  | { status: "loading" }
  | { status: "ready"; data: Shared }
  | { status: "locked" }
  | { status: "expired" }
  | { status: "missing" }
  | { status: "failed" };

const storageKey = (slug: string) => `pickit.share-key.${slug}`;

function storedKey(slug: string): string {
  try {
    return sessionStorage.getItem(storageKey(slug)) ?? "";
  } catch {
    return "";
  }
}

function storeKey(slug: string, key: string) {
  try {
    sessionStorage.setItem(storageKey(slug), key);
  } catch {
    // Blocked storage: the password is asked again after a reload.
  }
}

/**
 * A public share and its access flow. A password-protected share answers
 * "locked" until `unlock` succeeds; the access key is then kept for this tab
 * (or taken from a ?key= link) and sent with every request.
 */
export function usePublicShare(slug: string) {
  const [state, setState] = useState<PublicShareState>({ status: "loading" });
  const [key, setKey] = useState(() => new URLSearchParams(location.search).get("key") ?? storedKey(slug));

  const load = useCallback(
    async (accessKey: string) => {
      // Pass on where the visitor came from: the fetch's own Referer is this page.
      const ref = document.referrer ? `?ref=${encodeURIComponent(document.referrer)}` : "";
      try {
        const data = await api<Shared>(`/api/public/shares/${slug}${ref}`, {
          headers: accessKey ? { "X-Share-Key": accessKey } : undefined,
        });
        document.title = `${data.title} · PickIt`;
        setState({ status: "ready", data });
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0;
        setState({
          status: status === 401 ? "locked" : status === 410 ? "expired" : status === 404 ? "missing" : "failed",
        });
      }
    },
    [slug],
  );

  useEffect(() => {
    load(key);
  }, [load, key]);

  /** Checks the password; resolves to false when it is wrong (other errors throw). */
  async function unlock(password: string): Promise<boolean> {
    try {
      const { key: next } = await api<{ key: string }>(`/api/public/shares/${slug}/unlock`, { json: { password } });
      storeKey(slug, next);
      setKey(next);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return false;
      if (err instanceof ApiError && err.status === 410) setState({ status: "expired" });
      throw err;
    }
  }

  return { state, key, unlock };
}
