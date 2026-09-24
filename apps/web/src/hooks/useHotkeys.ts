import { useEffect, useEffectEvent } from "react";

/** Whether a key press belongs to something else: typing, a dialog, a menu. */
function isBusy(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  const target = e.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return true;
  // Keys inside an open dialog, sheet or menu are theirs.
  return !!document.querySelector("[role='dialog'], [role='alertdialog'], [role='menu']");
}

/**
 * Single-key shortcuts (e.g. "j", "/", "?", "Enter"), matched on
 * `KeyboardEvent.key`. Ignored while typing or while a dialog / menu is open.
 * A handler may return false to let the key through.
 */
export function useHotkeys(handlers: Record<string, (e: KeyboardEvent) => void | false>, enabled = true) {
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const handler = handlers[e.key];
    if (!handler || isBusy(e)) return;
    if (handler(e) !== false) e.preventDefault();
  });

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
