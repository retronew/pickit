import type { CSSProperties, ReactNode } from "react";
import { useOverflow } from "#hooks/useOverflow";
import { cn } from "#lib/utils";

/** Scroll speed in px/s; the ends pause for part of each pass (see the keyframes). */
const SPEED = 30;

/**
 * Single-line text that scrolls back and forth when it doesn't fit, fading
 * whichever edge still hides text (each fade eases out as the text reaches
 * that end). Truncates with an ellipsis when motion is reduced. Fits → plain text.
 */
export function MarqueeText({ children, className }: { children: ReactNode; className?: string }) {
  const { outerRef, innerRef, overflow } = useOverflow<HTMLSpanElement, HTMLSpanElement>();
  const scrolling = overflow > 0;
  // Moving takes 60% of each pass; pauses fill the rest.
  const duration = `${Math.max(2, overflow / SPEED / 0.6)}s`;

  return (
    <span
      ref={outerRef}
      // The duration is read by both animations: the scroll (inner) and the edge fades (outer).
      style={scrolling ? ({ "--marquee-duration": duration } as CSSProperties) : undefined}
      className={cn(
        "block min-w-0 overflow-hidden whitespace-nowrap",
        scrolling &&
          "marquee-mask motion-safe:animate-marquee-fade motion-reduce:text-ellipsis motion-reduce:mask-none",
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
              } as CSSProperties)
            : undefined
        }
      >
        {children}
      </span>
    </span>
  );
}
