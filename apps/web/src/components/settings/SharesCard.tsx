import { api, copyText, toastError, toastSuccess } from "#lib/api";
import { SHARE_TYPE_LABELS, rssUrl, type ShareType } from "#lib/shares";
import { Badge } from "#components/ui/badge";
import { ListSkeleton } from "#components/settings/skeletons";
import { useEffect, useState } from "react";
import { CopyIcon, Trash2Icon, RssIcon } from "lucide-react";
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
  const [shares, setShares] = useState<Share[] | null>(null);

  function refresh() {
    return api<Share[]>("/api/shares")
      .then(setShares)
      .catch(() => setShares((prev) => prev ?? []));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function remove(slug: string) {
    try {
      await api(`/api/shares/${slug}`, { method: "DELETE" });
      toastSuccess("已撤销分享", { id: "share" });
    } catch (err) {
      toastError("撤销失败", err, { id: "share" });
    }
    refresh();
  }

  async function copy(slug: string) {
    await copyText(`${window.location.origin}/s/${slug}`, "分享链接已复制");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>公开分享</CardTitle>
        <CardDescription>
          单条收藏在详情里分享；分类或标签可以在收藏页筛选后分享，或在标签页分享，访问者看到的列表会随收藏自动更新，并提供 RSS 订阅。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {shares === null ? (
          <ListSkeleton rows={2} />
        ) : shares.length === 0 ? (
          <p className="animate-fade-in text-muted-foreground text-sm">还没有分享链接。</p>
        ) : (
          <div className="animate-fade-in space-y-1">
            {shares.map((s) => (
              <div
                key={s.slug}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Badge variant={s.type === "item" ? "secondary" : "info"} size="sm">
                    {SHARE_TYPE_LABELS[s.type as ShareType] ?? s.type}
                  </Badge>
                  <a
                    href={`/s/${s.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate underline-offset-2 hover:underline"
                  >
                    {s.title || s.value}
                  </a>
                </span>
                <div className="flex shrink-0 items-center gap-0.5">
                  {s.type !== "item" && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="复制 RSS 订阅地址"
                      title="复制 RSS 订阅地址"
                      onClick={() => copyText(rssUrl(s.slug), "RSS 地址已复制")}
                    >
                      <RssIcon />
                    </Button>
                  )}
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
