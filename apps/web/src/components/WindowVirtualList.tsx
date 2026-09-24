import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

/**
 * A list virtualized against the window scroll: only rows near the viewport
 * are mounted. Row heights start from `estimateSize` and are measured after
 * render, so rows can vary in height. Put spacing inside rows (padding), not
 * as margins between them.
 */
export function WindowVirtualList<T>({
  rows,
  getKey,
  estimateSize,
  renderRow,
  overscan = 6,
}: {
  rows: T[];
  getKey: (row: T) => string;
  estimateSize: (row: T) => number;
  renderRow: (row: T) => ReactNode;
  overscan?: number;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  // Where the list starts on the page; content above it (search, filters) shifts it.
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (i) => estimateSize(rows[i]),
    getItemKey: (i) => getKey(rows[i]),
    overscan,
    scrollMargin,
  });

  return (
    <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((v) => (
        <div
          key={v.key}
          data-index={v.index}
          ref={virtualizer.measureElement}
          className="absolute inset-x-0 top-0"
          style={{ transform: `translateY(${v.start - scrollMargin}px)` }}
        >
          {renderRow(rows[v.index])}
        </div>
      ))}
    </div>
  );
}
