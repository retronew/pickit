import { Streamdown, defaultRemarkPlugins } from "streamdown";
import remarkBreaks from "remark-breaks";

const BREAKS_PLUGINS = [...Object.values(defaultRemarkPlugins), remarkBreaks];

export interface MarkdownProps {
  children: string;
  /** "static" for finished text; the default suits streamed text. */
  mode?: "static" | "streaming";
  /** Treat single newlines as line breaks (notes typed by hand). */
  breaks?: boolean;
}

/** The heavy part: only loaded through `Markdown`. */
export default function MarkdownRenderer({ children, mode, breaks }: MarkdownProps) {
  return (
    <Streamdown mode={mode} remarkPlugins={breaks ? BREAKS_PLUGINS : undefined}>
      {children}
    </Streamdown>
  );
}
