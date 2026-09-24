import { useEffect, useState } from "react";
import { createCallable } from "react-call";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "#components/ui/dialog";
import { Button } from "#components/ui/button";
import { RadioGroup, Radio } from "#components/ui/radio-group";
import { Skeleton } from "#components/ui/skeleton";
import { errorMessage, toastError } from "#lib/api";
import { restoreBackup, type RestoreMode, type RestoreResult } from "#hooks/useBackups";
import { m } from "#lib/i18n";

const MODES: Record<RestoreMode, { label: string; hint: string }> = {
  merge: {
    label: m.restore_merge(),
    hint: m.restore_merge_hint(),
  },
  replace: {
    label: m.restore_replace(),
    hint: m.restore_replace_hint(),
  },
};

function Preview({ result }: { result: RestoreResult }) {
  return (
    <ul className="space-y-1 text-sm">
      <li>
        {m.restore_preview({ total: result.total, inserted: result.inserted })}
        {result.skipped > 0 && m.restore_preview_skipped({ skipped: result.skipped })}
      </li>
      {result.trashed > 0 && (
        <li className="text-warning-foreground">{m.restore_preview_trashed({ trashed: result.trashed })}</li>
      )}
      <li className="text-muted-foreground text-xs">{m.restore_safety()}</li>
    </ul>
  );
}

/** Choose merge / replace, see a dry-run preview, then restore. */
export const RestoreDialog = createCallable<{ name: string }, RestoreResult | null>(
  ({ name, call }) => {
    const [entered, setEntered] = useState(false);
    const [mode, setMode] = useState<RestoreMode>("merge");
    const [preview, setPreview] = useState<RestoreResult | null>(null);
    const [previewError, setPreviewError] = useState("");
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }, []);

    useEffect(() => {
      let stale = false;
      setPreview(null);
      setPreviewError("");
      restoreBackup(name, mode, true)
        .then((r) => !stale && setPreview(r))
        .catch((err) => !stale && setPreviewError(errorMessage(err)));
      return () => {
        stale = true;
      };
    }, [name, mode]);

    async function restore() {
      setRestoring(true);
      try {
        call.end(await restoreBackup(name, mode, false));
      } catch (err) {
        toastError(m.restore_failed(), err, { id: "restore" });
        setRestoring(false);
      }
    }

    return (
      <Dialog
        open={entered && !call.ended}
        onOpenChange={(open) => {
          if (!open && !restoring) call.end(null);
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{m.restore_title()}</DialogTitle>
            <DialogDescription className="break-all">{name}</DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as RestoreMode)} className="gap-3">
              {(Object.keys(MODES) as RestoreMode[]).map((key) => (
                <label key={key} className="flex items-start gap-2 text-sm">
                  <Radio value={key} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{MODES[key].label}</span>
                    <span className="block text-muted-foreground text-xs">{MODES[key].hint}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            <div className="min-h-16 rounded-lg border bg-muted/30 p-3">
              {previewError ? (
                <p className="text-destructive text-sm">{previewError}</p>
              ) : preview ? (
                <div className="animate-fade-in">
                  <Preview result={preview} />
                </div>
              ) : (
                <div className="space-y-2" aria-busy="true">
                  <Skeleton className="h-4 w-64 max-w-full" />
                  <Skeleton className="h-3 w-48" />
                </div>
              )}
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button variant="outline" disabled={restoring} onClick={() => call.end(null)}>
              {m.common_cancel()}
            </Button>
            <Button
              variant={mode === "replace" ? "destructive" : "default"}
              disabled={!preview || restoring}
              loading={restoring}
              onClick={restore}
            >
              {mode === "replace" ? m.restore_replace_button() : m.restore_merge_button()}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    );
  },
  200,
);
