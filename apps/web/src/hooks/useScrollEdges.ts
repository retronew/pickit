import { useEffect, useState, type RefObject } from "react";

/**
 * Whether a horizontally scrolling element has more content off either edge,
 * e.g. to show a fade only on the side that can still scroll.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      // 1px slack for sub-pixel scroll positions.
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [ref]);

  return edges;
}
