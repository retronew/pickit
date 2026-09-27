import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, toastError } from "#lib/api";
import { m } from "#lib/i18n";
import { itemContentQuery } from "#lib/queries";

export interface ItemContent {
  /** False when the server has no R2 bucket: the feature is off. */
  enabled: boolean;
  status: "" | "ok" | "empty" | "failed";
  capturedAt: number | null;
  size: number | null;
  text: string | null;
}

/** The page text snapshot of one bookmark: its status, the text on demand, and refetching. */
export function useItemContent(itemId: number, open: boolean) {
  const queryClient = useQueryClient();
  const query = itemContentQuery(itemId);
  const content = useQuery({ ...query, enabled: open }).data ?? null;
  const [busy, setBusy] = useState(false);
  const setContent = useCallback(
    (c: ItemContent) => queryClient.setQueryData(query.queryKey, c),
    [queryClient, itemId],
  );

  /** Loads the text (not fetched until the reader opens). */
  const loadText = useCallback(async (): Promise<string | null> => {
    try {
      const c = await api<ItemContent>(`/api/items/${itemId}/content?text=1`);
      setContent(c);
      return c.text;
    } catch (err) {
      toastError(m.content_load_failed(), err, { id: "content" });
      return null;
    }
  }, [itemId, setContent]);

  /** Captures the page again now; an old snapshot is kept if the page can't be read. */
  const refetch = useCallback(async () => {
    setBusy(true);
    try {
      const c = await api<ItemContent>(`/api/items/${itemId}/content`, { method: "POST" });
      setContent(c);
      if (c.status !== "ok") toastError(c.status === "empty" ? m.content_empty() : m.content_failed(), undefined, { id: "content" });
      return c;
    } catch (err) {
      toastError(m.content_failed(), err, { id: "content" });
      return null;
    } finally {
      setBusy(false);
    }
  }, [itemId, setContent]);

  return { content, busy, loadText, refetch };
}
