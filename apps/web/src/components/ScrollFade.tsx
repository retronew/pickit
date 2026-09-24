import { useRef, type ReactNode, type RefObject } from "react";
import { useScrollEdges } from "#hooks/useScrollEdges";
import { cn } from "#lib/utils";

/**
 * A horizontal scroller with a hidden scrollbar that fades only the edge
 * which still has content beyond it. `min-w-0` keeps it from widening a flex
 * parent (and with it the page).
 */
export function ScrollFade({
  as: Tag = "div",
  ref,
  className,
  children,
}: {
  as?: "div" | "nav";
  ref?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}) {
  const ownRef = useRef<HTMLElement>(null);
  const el = ref ?? ownRef;
  const edges = useScrollEdges(el);
  return (
    <Tag
      ref={el as RefObject<HTMLDivElement>}
      className={cn(
        "min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        edges.start && "mask-l-from-[calc(100%-1.5rem)]",
        edges.end && "mask-r-from-[calc(100%-1.5rem)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
