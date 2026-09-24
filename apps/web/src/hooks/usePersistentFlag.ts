import { useState } from "react";

function read(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "1";
  } catch {
    return fallback;
  }
}

/** An on / off preference remembered in this browser (e.g. a page's live refresh). */
export function usePersistentFlag(key: string, fallback: boolean) {
  const [value, setValue] = useState(() => read(key, fallback));

  function change(next: boolean) {
    setValue(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {
      // Not remembered; still applies now.
    }
  }

  return [value, change] as const;
}
