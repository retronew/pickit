import { AiJobCard } from "#components/settings/AiJobCard";
import { m } from "#lib/i18n";

/** Background AI summaries for the whole library. */
export function SummarizeCard() {
  return (
    <AiJobCard
      kind="summarize"
      title={m.summarize_job_title()}
      description={m.summarize_job_description()}
      startLabel={m.summarize_job_start()}
      modeLabels={{ missing: m.summarize_mode_missing(), all: m.summarize_mode_all() }}
    />
  );
}
