import { AiJobCard } from "#components/settings/AiJobCard";
import { m } from "#lib/i18n";

/** Background AI organizing: categories and tags for the whole library. */
export function OrganizeCard() {
  return (
    <AiJobCard
      kind="organize"
      title={m.organize_job_title()}
      description={m.organize_job_description()}
      startLabel={m.organize_job_start()}
      modeLabels={{ missing: m.organize_mode_missing(), all: m.organize_mode_all() }}
    />
  );
}
