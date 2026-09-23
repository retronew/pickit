import { useEffect, useState } from "react";
import { createCallable } from "react-call";
import {
  AlertDialog,
  AlertDialogPopup,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from "#components/ui/alert-dialog";
import { Button } from "#components/ui/button";
import { m } from "#lib/i18n";

interface Props {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export const Confirm = createCallable<Props, boolean>(
  ({ title, message, confirmLabel = m.common_ok(), danger, call }) => {
    // Starts closed so Base UI has a real false→true transition to animate —
    // flips true one frame after mount (mirrors @retronew/call-vue's demo).
    const [entered, setEntered] = useState(false);
    useEffect(() => {
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }, []);

    return (
      <AlertDialog
        open={entered && !call.ended}
        onOpenChange={(open) => {
          if (!open) call.end(false);
        }}
      >
        <AlertDialogPopup onBackdropClick={() => call.end(false)}>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {message && (
              <AlertDialogDescription>{message}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              {m.common_cancel()}
            </AlertDialogClose>
            <Button
              variant={danger ? "destructive" : "default"}
              onClick={() => call.end(true)}
            >
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    );
  },
  200,
);
