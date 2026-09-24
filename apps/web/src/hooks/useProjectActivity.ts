import { useEffect, useState } from "react";
import type { ProjectActivity } from "@pickit/shared";
import { api, toastError } from "#lib/api";
import { m } from "#lib/i18n";

/** A bookmark's project activity, with a "check again now". */
export function useProjectActivity(itemId: number, initial: ProjectActivity | null, onChanged: () => void) {
  const [activity, setActivity] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => setActivity(initial), [itemId, initial]);

  async function refresh() {
    setBusy(true);
    try {
      setActivity(await api<ProjectActivity>(`/api/items/${itemId}/activity`, { method: "POST" }));
      onChanged();
    } catch (err) {
      toastError(m.activity_refresh_failed(), err, { id: "activity" });
    } finally {
      setBusy(false);
    }
  }

  return { activity, busy, refresh };
}
