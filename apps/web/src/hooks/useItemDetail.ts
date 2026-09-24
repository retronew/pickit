import { useEffect, useEffectEvent, useState } from "react";
import type { Item } from "@pickit/shared";
import { api, copyText, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

interface LinkStatus {
  httpStatus: number | null;
  checkedAt: number | null;
  /** Wayback Machine snapshot, found once the link is dead. */
  archiveUrl: string;
}

/** Related items, AI summary, link check and sharing for the detail sheet. */
export function useItemDetail(item: Item | null, open: boolean, onChanged: () => void) {
  const [related, setRelated] = useState<Item[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  // Reads the item at open time without re-running for every new object of it.
  const showItem = useEffectEvent(() => {
    if (!item) return;
    setSummary(item.aiSummary ?? "");
    setRelated([]);
    setLinkStatus({ httpStatus: item.httpStatus, checkedAt: item.checkedAt, archiveUrl: item.archiveUrl });
    setShared(false);
  });

  // Reset and load only on open, keyed on the id: clearing on close would
  // shrink the sheet mid-way through its closing animation, and a list refresh
  // hands in a new object for the same item that shouldn't clear the screen.
  const itemId = item?.id;
  useEffect(() => {
    if (itemId == null || !open) return;
    showItem();
    let cancelled = false;
    setRelatedLoading(true);
    fetch(`/api/items/${itemId}/related?limit=6`)
      .then((r) => r.json())
      .then((data: Item[]) => {
        if (!cancelled) setRelated(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRelatedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, open]);

  async function checkLinkNow() {
    if (!item) return;
    setChecking(true);
    try {
      const data = await api<LinkStatus>(
        `/api/items/${item.id}/check`,
        { method: "POST" },
      );
      setLinkStatus(data);
      onChanged();
      if (data.httpStatus != null && data.httpStatus < 400) {
        toastSuccess(m.link_reachable(), { id: "check" });
      } else {
        const reason = data.httpStatus ? `HTTP ${data.httpStatus}` : m.link_timeout();
        toastError(m.link_unreachable(), new Error(reason), { id: "check" });
      }
    } catch (err) {
      toastError(m.link_check_failed(), err, { id: "check" });
    } finally {
      setChecking(false);
    }
  }

  async function summarize() {
    if (!item) return;
    setSummarizing(true);
    try {
      const data = await api<{ summary: string }>(`/api/items/${item.id}/summarize`, {
        method: "POST",
      });
      setSummary(data.summary);
      onChanged();
    } catch (err) {
      toastError(m.summarize_failed(), err, { id: "summarize" });
    } finally {
      setSummarizing(false);
    }
  }

  async function share() {
    if (!item) return;
    setSharing(true);
    try {
      const data = await api<{ slug: string }>("/api/shares", {
        json: { type: "item", value: String(item.id), title: item.name },
      });
      if (await copyText(`${window.location.origin}/s/${data.slug}`, m.share_link_copied())) {
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch (err) {
      toastError(m.share_failed(), err, { id: "share" });
    } finally {
      setSharing(false);
    }
  }

  return {
    related,
    relatedLoading,
    summary,
    summarizing,
    linkStatus,
    checking,
    sharing,
    shared,
    checkLinkNow,
    summarize,
    share,
  };
}
