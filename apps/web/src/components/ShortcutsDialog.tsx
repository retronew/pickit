import { useState } from "react";
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogPanel } from "#components/ui/dialog";
import { Kbd } from "#components/ui/kbd";
import { useHotkeys } from "#hooks/useHotkeys";
import { m } from "#lib/i18n";

const SHORTCUTS: { keys: string[]; label: () => string }[] = [
  { keys: ["⌘", "K"], label: m.shortcut_palette },
  { keys: ["/"], label: m.shortcut_search },
  { keys: ["N"], label: m.shortcut_add },
  { keys: ["J", "K"], label: m.shortcut_move },
  { keys: ["Enter"], label: m.shortcut_detail },
  { keys: ["O"], label: m.shortcut_open },
  { keys: ["E"], label: m.shortcut_edit },
  { keys: ["P"], label: m.shortcut_pin },
  { keys: ["?"], label: m.shortcut_help },
];

/** "?" opens a list of the keyboard shortcuts. */
export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);
  useHotkeys({ "?": () => setOpen(true) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPopup className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{m.shortcut_title()}</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <dl className="space-y-2 text-sm">
            {SHORTCUTS.map(({ keys, label }) => (
              <div key={keys.join("+")} className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">{label()}</dt>
                <dd className="flex gap-1">
                  {keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
