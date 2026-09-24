import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "#components/ui/tooltip";

interface Props {
  /** Tooltip text; nothing is wrapped when empty. */
  content: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  /** The element that shows the tooltip on hover / focus. */
  children: ReactElement;
}

/** A styled tooltip on any element: use this instead of the native `title`. */
export function Hint({ content, side, children }: Props) {
  if (!content) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup side={side}>{content}</TooltipPopup>
    </Tooltip>
  );
}
