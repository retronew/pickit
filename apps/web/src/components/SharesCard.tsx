import { useEffect, useState } from "react";
import { CopyIcon, Trash2Icon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "#components/ui/card";
import { Button } from "#components/ui/button";

interface Share {
  slug: string;
  title: string;
  type: string;
  value: string;
  createdAt: number;
}

export function SharesCard() {
  const [shares, setShares] = useState<Share[]>([]);

  function refresh() {
    return fetch("/api/shares")
      .then((r) => r.json())
      .then(setShares);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function remove(slug: string) {
    await fetch(`/api/shares/${slug}`, { method: "DELETE" });
    refresh();
  }

  async function copy(slug: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/s/${slug}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>公开分享</CardTitle>
        <CardDescription>
          在收藏详情里点「分享」生成的链接会列在这里，随时可以撤销。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {shares.length === 0 ? (
          <p className="text-muted-foreground text-sm">还没有分享过收藏。</p>
        ) : (
          <div className="space-y-1">
            {shares.map((s) => (
              <div
                key={s.slug}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50"
              >
                <span className="truncate">{s.title || s.value}</span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="复制链接"
                    onClick={() => copy(s.slug)}
                  >
                    <CopyIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="撤销分享"
                    onClick={() => remove(s.slug)}
                    className="text-muted-foreground hover:text-destructive-foreground"
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
