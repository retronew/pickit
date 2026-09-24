import type { CSSProperties, ReactNode } from "react";
import { useOverflow } from "#hooks/useOverflow";
import { cn } from "#lib/utils";

/** Scroll speed in px/s; the ends pause for part of each pass (see the keyframes). */
const SPEED = 30;

/**
 * Single-line text that scrolls back and forth when it doesn't fit, and
 * truncates with an ellipsis when motion is reduced. Fits → plain text.
 */
export function MarqueeText({ children, className }: { children: ReactNode; className?: string }) {
  const { outerRef, innerRef, overflow } = useOverflow<HTMLSpanElement, HTMLSpanElement>();
  const scrolling = overflow > 0;

  return (
    <span
      ref={outerRef}
      className={cn(
        "block min-w-0 overflow-hidden whitespace-nowrap",
        scrolling &&
          "mask-r-from-[calc(100%-0.75rem)] motion-reduce:text-ellipsis motion-reduce:mask-none",
        className,
      )}
    >
      <span
        ref={innerRef}
        className={cn("inline-block", scrolling && "motion-safe:animate-marquee motion-reduce:inline")}
        style={
          scrolling
            ? ({
                "--marquee-distance": `-${overflow}px`,
                // Moving takes 60% of each pass; pauses fill the rest.
                "--marquee-duration": `${Math.max(2, overflow / SPEED / 0.6)}s`,
              } as CSSProperties)
            : undefined
        }
      >
        {children}
      </span>
    </span>
  );
}
