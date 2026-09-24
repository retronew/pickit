import { useRef, useState } from "react";
import type { ItemFormPayload } from "#components/items/ItemFormFields";
import type { AnalyzeResult, PossibleDuplicate } from "#hooks/useUrlAnalyzer";
import { api, ApiError, errorMessage } from "#lib/api";
import { hostnameOf } from "#lib/batch-urls";

export type Decision = "pending" | "accepted" | "discarded";

export interface BatchEntry {
  url: string;
  /** AI analysis of the URL; the form is editable meanwhile. */
  status: "analyzing" | "ready" | "failed";
  form: ItemFormPayload;
  duplicates: PossibleDuplicate[];
  decision: Decision;
  /** Set when saving this entry failed; it stays for another try. */
  saveError?: string;
}

export interface BatchSaveResult {
  added: number;
  skipped: number;
  failed: number;
}

const CONCURRENCY = 2;

/**
 * Batch add: analyze pasted URLs in the background, let the user accept,
 * edit or discard each one, then save the accepted ones.
 */
export function useBatchAdd() {
  const [entries, setEntries] = useState<BatchEntry[]>([]);
  const [saving, setSaving] = useState(false);
  // Bumped on reset so a run still in flight stops writing into a new batch.
  const runRef = useRef(0);

  const patch = (url: string, update: (entry: BatchEntry) => BatchEntry) =>
    setEntries((list) => list.map((e) => (e.url === url ? update(e) : e)));

  function start(urls: string[]) {
    const run = ++runRef.current;
    setEntries(
      urls.map((url) => ({
        url,
        status: "analyzing",
        form: { name: hostnameOf(url), url, icon: "", note: "", category: "", tags: [] },
        duplicates: [],
        decision: "pending",
      })),
    );

    let next = 0;
    async function worker() {
      while (next < urls.length && run === runRef.current) {
        const url = urls[next++];
        try {
          const data = await api<AnalyzeResult>("/api/items/analyze", { json: { url } });
          if (run !== runRef.current) return;
          // Fields the user already typed into win over the analysis.
          patch(url, (e) => ({
            ...e,
            status: "ready",
            duplicates: data.possibleDuplicates ?? [],
            form: {
              ...e.form,
              name: e.form.name !== hostnameOf(url) ? e.form.name : data.name || e.form.name,
              note: e.form.note || data.note || "",
              category: e.form.category || data.category || "",
              tags: e.form.tags.length ? e.form.tags : (data.tags ?? []),
              icon: data.icon || e.form.icon,
            },
          }));
        } catch {
          if (run === runRef.current) patch(url, (e) => ({ ...e, status: "failed" }));
        }
      }
    }
    for (let i = 0; i < CONCURRENCY; i++) worker();
  }

  function updateForm(url: string, update: (form: ItemFormPayload) => ItemFormPayload) {
    patch(url, (e) => ({ ...e, form: update(e.form) }));
  }

  function decide(url: string, decision: Decision) {
    patch(url, (e) => ({ ...e, decision }));
  }

  /** Saves the accepted entries; saved or already-present ones leave the batch. */
  async function saveAccepted(): Promise<BatchSaveResult> {
    const result: BatchSaveResult = { added: 0, skipped: 0, failed: 0 };
    setSaving(true);
    for (const entry of entries.filter((e) => e.decision === "accepted")) {
      try {
        await api("/api/items", { json: entry.form });
        result.added++;
        setEntries((list) => list.filter((e) => e.url !== entry.url));
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          result.skipped++;
          setEntries((list) => list.filter((e) => e.url !== entry.url));
        } else {
          result.failed++;
          patch(entry.url, (e) => ({ ...e, saveError: errorMessage(err) }));
        }
      }
    }
    setSaving(false);
    return result;
  }

  function reset() {
    runRef.current++;
    setEntries([]);
  }

  return { entries, saving, start, updateForm, decide, saveAccepted, reset };
}
