import { useState } from "react";
import { CopyIcon, CheckIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "#components/ui/card";
import { Button } from "#components/ui/button";

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

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>一键收藏（书签小工具）</CardTitle>
        <CardDescription>
          把下面这个按钮拖到浏览器书签栏，以后在任何页面点一下就能收藏。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <a
            href={code}
            className="max-w-full truncate rounded-lg border bg-muted px-3 py-2 font-mono text-xs"
            onClick={(e) => e.preventDefault()}
            draggable
          >
            📌 收藏到 pickit
          </a>
          <Button variant="outline" size="icon-sm" aria-label="复制代码" onClick={copy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          有些浏览器不能直接拖动：先复制代码，再新建书签，把代码粘贴到「网址」栏。
        </p>
      </CardContent>
    </Card>
  );
}
