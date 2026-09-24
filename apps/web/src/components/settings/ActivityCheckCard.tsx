import { AiJobCard } from "#components/settings/AiJobCard";
import { m } from "#lib/i18n";

/** Checks the activity of every GitHub / npm bookmark, with progress like the other batch jobs. */
export function ActivityCheckCard() {
  return (
    <AiJobCard
      kind="activity"
      title={m.activity_job_title()}
      description={m.activity_job_description()}
      startLabel={m.activity_job_start()}
      modeLabels={{ missing: m.activity_mode_missing(), all: m.activity_mode_all() }}
    />
  );
}
