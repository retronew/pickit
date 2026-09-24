import { useEffect, useState } from "react";

/**
 * `active`, but only once it has stayed true for `delay` ms; turns false right
 * away. Keeps quick operations from flashing a loading state.
 */
export function useDelayedFlag(active: boolean, delay = 400): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);
  return active && shown;
}
