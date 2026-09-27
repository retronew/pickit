import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BrowserRenderInfo, BrowserRenderSettings } from "@pickit/shared";
import { api, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";
import { browserRenderQuery } from "#lib/queries";
import { useRefresh } from "#hooks/useRefresh";

const URL = "/api/settings/browser-render";

/** Browser Rendering on the settings page: settings and usage this period. */
export function useBrowserRender() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    ...browserRenderQuery,
    meta: { errorToast: { title: m.browser_render_load_failed, id: "browser-render" } },
  });
  const [saving, setSaving] = useState(false);
  const refresh = useRefresh(browserRenderQuery.queryKey);
  const setInfo = (next: BrowserRenderInfo) => queryClient.setQueryData(browserRenderQuery.queryKey, next);

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

  return { info: data ?? null, saving, refresh, save };
}
