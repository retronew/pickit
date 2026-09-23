import { useEffect, useRef, useState } from "react";
import { createCallable } from "react-call";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
  DialogClose,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Button } from "#components/ui/button";
import { m } from "#lib/i18n";

interface Props {
  title: string;
  description?: string;
  defaultValue?: string;
  confirmLabel?: string;
}

export const Prompt = createCallable<Props, string | null>(
  ({ title, description, defaultValue = "", confirmLabel = m.common_ok(), call }) => {
    const [entered, setEntered] = useState(false);
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }, []);

    function submit() {
      const trimmed = value.trim();
      if (!trimmed) return;
      call.end(trimmed);
    }

    return (
      <Dialog
        open={entered && !call.ended}
        onOpenChange={(open) => {
          if (!open) call.end(null);
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogPanel>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <Input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
            </form>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {m.common_cancel()}
            </DialogClose>
            <Button onClick={submit} disabled={!value.trim()}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    );
  },
  200,
);
