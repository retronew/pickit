import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AiUsageRetention } from "@pickit/shared";
import { api, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";
import { aiUsageQuery, aiUsageSettingsQuery } from "#lib/queries";
import { retentionLabel } from "#components/RetentionSelect";

const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** AI token usage over the last `days`, counted in the browser's time zone. */
export function useAiUsage(days: number) {
  const timeZone = browserTimeZone();
  const report = useQuery({
    ...aiUsageQuery(days, timeZone),
    placeholderData: keepPreviousData,
    meta: { errorToast: { title: m.ai_usage_load_failed, id: "ai-usage" } },
  });
  return { report: report.data ?? null, loading: report.isFetching };
}

/** How long usage records are kept, and changing it (prunes right away). */
export function useAiUsageRetention() {
  const client = useQueryClient();
  const { data } = useQuery(aiUsageSettingsQuery);

  async function save(days: number) {
    try {
      const res = await api<AiUsageRetention & { deleted: number }>("/api/ai-usage/settings", {
        method: "PUT",
        json: { retentionDays: days },
      });
      client.setQueryData(aiUsageSettingsQuery.queryKey, res);
      if (res.deleted) client.invalidateQueries({ queryKey: ["ai-usage"] });
      toastSuccess(m.ai_usage_retention_saved({ retention: retentionLabel(res.retentionDays) }), {
        description: res.deleted ? m.retention_pruned({ count: res.deleted }) : undefined,
        id: "ai-usage-retention",
      });
    } catch (err) {
      toastError(m.retention_failed(), err, { id: "ai-usage-retention" });
      throw err;
    }
  }

  return { retention: data ?? null, save };
}
