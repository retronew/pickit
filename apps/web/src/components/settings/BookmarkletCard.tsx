import { useEffect, useRef, useState } from "react";
import { copyText } from "#lib/api";
import { CopyIcon, CheckIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "#components/ui/card";
import { Button } from "#components/ui/button";
import { m } from "#lib/i18n";

function buildBookmarklet(): string {
  const origin = window.location.origin;
  const js =
    `void open('${origin}/add?url='+encodeURIComponent(location.href)+` +
    `'&title='+encodeURIComponent(document.title))`;
  return `javascript:${js}`;
}

export function BookmarkletCard() {
  const [copied, setCopied] = useState(false);
  const code = buildBookmarklet();
  const linkRef = useRef<HTMLAnchorElement>(null);

  // React 19 replaces javascript: hrefs with an error-throwing stub, so the
  // bookmarklet has to be set on the DOM node directly.
  useEffect(() => {
    linkRef.current?.setAttribute("href", code);
  }, [code]);

  async function copy() {
    if (!(await copyText(code, m.bookmarklet_copied()))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.bookmarklet_title()}</CardTitle>
        <CardDescription>
          {m.bookmarklet_description()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <a
            ref={linkRef}
            className="max-w-full truncate rounded-lg border bg-muted px-3 py-2 font-mono text-xs"
            onClick={(e) => e.preventDefault()}
            draggable
          >
            {m.bookmarklet_button()}
          </a>
          <Button variant="outline" size="icon-sm" aria-label={m.bookmarklet_copy()} onClick={copy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {m.bookmarklet_hint()}
        </p>
      </CardContent>
    </Card>
  );
}
