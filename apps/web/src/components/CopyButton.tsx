import { CheckIcon, CopyIcon } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "#components/ui/button";
import { copyText } from "#lib/api";

interface Props extends Omit<ComponentProps<typeof Button>, "onClick" | "children"> {
  text: string;
  /** Toast title on success; defaults to copyText's. */
  toast?: string;
  icon?: ReactNode;
}

/** Icon button that copies `text` and shows a check for a moment afterwards. */
export function CopyButton({ text, toast, icon = <CopyIcon />, ...props }: Props) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      {...props}
      onClick={async () => {
        if (await copyText(text, toast)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
    >
      {copied ? <CheckIcon /> : icon}
    </Button>
  );
}
