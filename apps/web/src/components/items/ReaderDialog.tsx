import { useEffect, useState } from "react";
import { createCallable } from "react-call";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
} from "#components/ui/dialog";
import { Skeleton } from "#components/ui/skeleton";
import { m } from "#lib/i18n";

interface Props {
  title: string;
  /** "Captured on …" line under the title. */
  captured: string;
  loadText: () => Promise<string | null>;
}

/** Reading view of a bookmark's saved page text. */
export const ReaderDialog = createCallable<Props, void>(({ title, captured, loadText, call }) => {
  const [entered, setEntered] = useState(false);
  const [text, setText] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    loadText().then(setText);
    return () => cancelAnimationFrame(raf);
  }, [loadText]);

  return (
    <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && call.end()}>
      <DialogPopup className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="line-clamp-2">{title}</DialogTitle>
          <DialogDescription>{captured}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {text === undefined ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : text ? (
            <article className="space-y-4 whitespace-pre-wrap break-words text-[15px] leading-7">{text}</article>
          ) : (
            <p className="text-muted-foreground text-sm">{m.content_load_failed()}</p>
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}, 200);
