import { api, copyText, toastError, toastSuccess } from "#lib/api";
import { ListSkeleton } from "#components/settings/skeletons";
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
          在收藏详情里点「分享」生成的链接会列在这里，随时可以撤销。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {shares === null ? (
          <ListSkeleton rows={2} />
        ) : shares.length === 0 ? (
          <p className="animate-fade-in text-muted-foreground text-sm">还没有分享过收藏。</p>
        ) : (
          <div className="animate-fade-in space-y-1">
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
