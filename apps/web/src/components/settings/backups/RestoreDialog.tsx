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

const MODES: Record<RestoreMode, { label: string; hint: string }> = {
  merge: {
    label: "合并",
    hint: "只添加现在没有的收藏（按网址判断），不改动已有收藏。",
  },
  replace: {
    label: "覆盖",
    hint: "把现有收藏全部移到回收站（可恢复），再恢复备份里的全部收藏。",
  },
};

function Preview({ result }: { result: RestoreResult }) {
  return (
    <ul className="space-y-1 text-sm">
      <li>
        备份共 <b>{result.total}</b> 条，将恢复 <b>{result.inserted}</b> 条
        {result.skipped > 0 && `，跳过 ${result.skipped} 条已存在的`}
      </li>
      {result.trashed > 0 && (
        <li className="text-warning-foreground">现有的 {result.trashed} 条收藏会移到回收站</li>
      )}
      <li className="text-muted-foreground text-xs">恢复前会自动备份当前数据，恢复错了也能再恢复回来。</li>
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
        toastError("恢复失败", err, { id: "restore" });
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
            <DialogTitle>恢复备份</DialogTitle>
            <DialogDescription className="break-all">{name}</DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as RestoreMode)} className="gap-3">
              {(Object.keys(MODES) as RestoreMode[]).map((m) => (
                <label key={m} className="flex items-start gap-2 text-sm">
                  <Radio value={m} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{MODES[m].label}</span>
                    <span className="block text-muted-foreground text-xs">{MODES[m].hint}</span>
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
            <Button variant="ghost" disabled={restoring} onClick={() => call.end(null)}>
              取消
            </Button>
            <Button
              variant={mode === "replace" ? "destructive" : "default"}
              disabled={!preview || restoring}
              loading={restoring}
              onClick={restore}
            >
              {mode === "replace" ? "覆盖恢复" : "合并恢复"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    );
  },
  200,
);
