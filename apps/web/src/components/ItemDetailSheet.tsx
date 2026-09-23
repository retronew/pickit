import { api, copyText, toastError, toastSuccess } from "#lib/api";
import { useEffect, useState } from "react";
import { Streamdown, defaultRemarkPlugins } from "streamdown";
import remarkBreaks from "remark-breaks";

// Single newlines in a note render as line breaks, like they were typed.
const NOTE_REMARK_PLUGINS = [...Object.values(defaultRemarkPlugins), remarkBreaks];
import {
  PencilIcon,
  PinIcon,
  SparklesIcon,
  Trash2Icon,
  ExternalLinkIcon,
  LinkIcon,
  Share2Icon,
} from "lucide-react";
import type { Item } from "@pickit/shared";
import {
  Sheet,
  SheetPopup,
  SheetHeader,
  SheetTitle,
  SheetPanel,
  SheetFooter,
} from "#components/ui/sheet";
import { Button } from "#components/ui/button";
import { Badge } from "#components/ui/badge";
import { Favicon } from "#components/Favicon";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ItemDetailSheet({
  item,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onTogglePin,
  onChanged,
  onOpenRelated,
}: {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onChanged: () => void;
  onOpenRelated: (item: Item) => void;
}) {
  const [related, setRelated] = useState<Item[]>([]);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [linkStatus, setLinkStatus] = useState<{
    httpStatus: number | null;
    checkedAt: number | null;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    setSummary(item?.aiSummary ?? "");
    setRelated([]);
    setLinkStatus(
      item ? { httpStatus: item.httpStatus, checkedAt: item.checkedAt } : null,
    );
    setShared(false);
    if (item && open) {
      fetch(`/api/items/${item.id}/related?limit=6`)
        .then((r) => r.json())
        .then(setRelated)
        .catch(() => {});
    }
  }, [item, open]);

  async function checkLinkNow() {
    if (!item) return;
    setChecking(true);
    try {
      const data = await api<{ httpStatus: number | null; checkedAt: number | null }>(
        `/api/items/${item.id}/check`,
        { method: "POST" },
      );
      setLinkStatus(data);
      onChanged();
      if (data.httpStatus != null && data.httpStatus < 400) {
        toastSuccess("链接可以访问", { id: "check" });
      } else {
        const reason = data.httpStatus ? `HTTP ${data.httpStatus}` : "请求超时或被拒绝";
        toastError("链接无法访问", new Error(reason), { id: "check" });
      }
    } catch (err) {
      toastError("检查失败", err, { id: "check" });
    } finally {
      setChecking(false);
    }
  }

  async function summarize() {
    if (!item) return;
    setSummarizing(true);
    try {
      const data = await api<{ summary: string }>(`/api/items/${item.id}/summarize`, {
        method: "POST",
      });
      setSummary(data.summary);
      onChanged();
    } catch (err) {
      toastError("生成摘要失败", err, { id: "summarize" });
    } finally {
      setSummarizing(false);
    }
  }

  async function share() {
    if (!item) return;
    setSharing(true);
    try {
      const data = await api<{ slug: string }>("/api/shares", {
        json: { type: "item", value: String(item.id), title: item.name },
      });
      if (await copyText(`${window.location.origin}/s/${data.slug}`, "分享链接已复制")) {
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch (err) {
      toastError("分享失败", err, { id: "share" });
    } finally {
      setSharing(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPopup>
        {item && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 pr-8">
                <Favicon url={item.url} name={item.name} />
                <span className="truncate">{item.name}</span>
              </SheetTitle>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => navigator.sendBeacon(`/api/items/${item.id}/visit`)}
                className="flex items-center gap-1 truncate text-muted-foreground text-sm hover:underline"
              >
                {item.url}
                <ExternalLinkIcon className="size-3.5 shrink-0" />
              </a>
              <div className="flex items-center gap-2 pt-0.5">
                {linkStatus?.checkedAt != null && (
                  <Badge
                    variant={
                      linkStatus.httpStatus != null && linkStatus.httpStatus < 400
                        ? "success"
                        : "destructive"
                    }
                    size="sm"
                  >
                    {linkStatus.httpStatus != null && linkStatus.httpStatus < 400
                      ? "链接正常"
                      : "链接失效"}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={checkLinkNow}
                  loading={checking}
                >
                  <LinkIcon />
                  检查链接
                </Button>
              </div>
            </SheetHeader>
            <SheetPanel className="space-y-5">
              {item.note && (
                <div className="text-sm leading-relaxed [&_a]:underline [&_code]:text-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-2">
                  <Streamdown remarkPlugins={NOTE_REMARK_PLUGINS}>{item.note}</Streamdown>
                </div>
              )}

              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.map((t) => (
                    <Badge key={t} variant="secondary" size="sm">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">分类</dt>
                <dd>{item.category || "未分类"}</dd>
                <dt className="text-muted-foreground">点击次数</dt>
                <dd>{item.clickCount}</dd>
                <dt className="text-muted-foreground">添加时间</dt>
                <dd>{formatDate(item.createdAt)}</dd>
                <dt className="text-muted-foreground">更新时间</dt>
                <dd>{formatDate(item.updatedAt)}</dd>
              </dl>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">AI 摘要</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={summarize}
                    loading={summarizing}
                  >
                    <SparklesIcon />
                    {summary ? "重新生成" : "生成摘要"}
                  </Button>
                </div>
                {summary && (
                  <p className="rounded-lg bg-muted/60 p-3 text-muted-foreground text-sm leading-relaxed">
                    {summary}
                  </p>
                )}
              </div>

              {related.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">相似收藏</h3>
                  <div className="space-y-1">
                    {related.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onOpenRelated(r)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        <Favicon url={r.url} name={r.name} />
                        <span className="truncate">{r.name}</span>
                        <span className="ml-auto shrink-0 text-muted-foreground text-xs">
                          {r.category}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </SheetPanel>
            <SheetFooter>
              <Button variant="outline" onClick={share} loading={sharing}>
                <Share2Icon />
                {shared ? "已复制链接" : "分享"}
              </Button>
              <Button
                variant="outline"
                onClick={onTogglePin}
                className={item.pinned ? "text-foreground" : undefined}
              >
                <PinIcon className={item.pinned ? "fill-current" : undefined} />
                {item.pinned ? "取消置顶" : "置顶"}
              </Button>
              <Button variant="outline" onClick={onEdit}>
                <PencilIcon />
                编辑
              </Button>
              <Button
                variant="outline"
                onClick={onDelete}
                className="text-destructive-foreground"
              >
                <Trash2Icon />
                删除
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetPopup>
    </Sheet>
  );
}
