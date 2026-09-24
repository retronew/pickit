import { useState } from "react";
import type { GroupMode } from "#lib/group-items";

const MODES: GroupMode[] = ["flat", "category", "tag"];

function load(key: string): GroupMode {
  try {
    const saved = localStorage.getItem(key) as GroupMode | null;
    return saved && MODES.includes(saved) ? saved : "flat";
  } catch {
    return "flat";
  }
}

/** How a list is grouped, remembered in this browser under `key`. */
export function useGroupMode(key: string) {
  const [mode, setMode] = useState<GroupMode>(() => load(key));

  function change(next: GroupMode) {
    setMode(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // Private mode or blocked storage: the choice just isn't remembered.
    }
  }

  return { mode, setMode: change };
}
