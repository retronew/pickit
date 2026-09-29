import { lazy, Suspense } from "react";
import type { MarkdownProps } from "#components/markdown/MarkdownRenderer";

// The Markdown stack (streamdown, micromark, parse5…) is large, so it loads on
// first use instead of in the main bundle.
const MarkdownRenderer = lazy(() => import("#components/markdown/MarkdownRenderer"));

/** Renders Markdown; shows the raw text until the renderer has loaded. */
export function Markdown(props: MarkdownProps) {
  return (
    <Suspense fallback={<div className="whitespace-pre-wrap">{props.children}</div>}>
      <MarkdownRenderer {...props} />
    </Suspense>
  );
}
