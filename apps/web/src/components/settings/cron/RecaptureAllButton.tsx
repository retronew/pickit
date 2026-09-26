import { RefreshCwIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { useRecaptureAll } from "#hooks/useRecaptureAll";
import { m } from "#lib/i18n";

/** "Recapture all" beside the page text backfill task. */
export function RecaptureAllButton({ onDone }: { onDone?: () => void }) {
  const { busy, recaptureAll } = useRecaptureAll(onDone);
  return (
    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={recaptureAll} loading={busy}>
      <RefreshCwIcon />
      {m.content_recapture_all()}
    </Button>
  );
}
