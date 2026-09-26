import { useCallback, useEffect, useState } from "react";
import type { BrowserRenderInfo, BrowserRenderSettings } from "@pickit/shared";
import { api, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

const URL = "/api/settings/browser-render";

/** Browser Rendering on the settings page: settings, usage this period, and the API token. */
export function useBrowserRender() {
  const [info, setInfo] = useState<BrowserRenderInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingToken, setSavingToken] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setInfo(await api<BrowserRenderInfo>(URL));
    } catch (err) {
      toastError(m.browser_render_load_failed(), err, { id: "browser-render" });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Saves the settings; resolves to true when saved. */
  async function save(settings: BrowserRenderSettings): Promise<boolean> {
    setSaving(true);
    try {
      setInfo(await api<BrowserRenderInfo>(URL, { method: "PUT", json: settings }));
      toastSuccess(m.browser_render_saved(), { id: "browser-render" });
      return true;
    } catch (err) {
      toastError(m.save_failed(), err, { id: "browser-render" });
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** Verifies the token with Cloudflare and saves it; resolves to true when saved. */
  async function saveToken(token: string): Promise<boolean> {
    setSavingToken(true);
    try {
      setInfo(await api<BrowserRenderInfo>(`${URL}/token`, { method: "PUT", json: { token } }));
      toastSuccess(m.browser_render_token_saved(), { id: "browser-render" });
      return true;
    } catch (err) {
      toastError(m.save_failed(), err, { id: "browser-render" });
      return false;
    } finally {
      setSavingToken(false);
    }
  }

  async function removeToken() {
    try {
      setInfo(await api<BrowserRenderInfo>(`${URL}/token`, { method: "DELETE" }));
    } catch (err) {
      toastError(m.save_failed(), err, { id: "browser-render" });
    }
  }

  return { info, saving, savingToken, refresh, save, saveToken, removeToken };
}
