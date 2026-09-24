import { useLayoutEffect, useRef, useState } from "react";

/**
 * How many pixels `outer`'s content overflows it horizontally (0 when it fits).
 * `inner` is observed too, so changes to the content re-measure.
 * Re-measures on resize of either element, e.g. a font load or grid change.
 */
export function useOverflow<O extends HTMLElement, I extends HTMLElement>() {
  const outerRef = useRef<O>(null);
  const innerRef = useRef<I>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () =>
      setOverflow(Math.max(0, Math.ceil(outer.scrollWidth - outer.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return { outerRef, innerRef, overflow };
}
