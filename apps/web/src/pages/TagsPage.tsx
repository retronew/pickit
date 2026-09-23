import { api, toastError, toastSuccess } from "#lib/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { Card } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Badge } from "#components/ui/badge";
import { Confirm } from "#components/Confirm";
import { Prompt } from "#components/Prompt";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "#components/ui/empty";
import { PageLoading } from "#components/PageLoading";

interface TagRow {
  tag: string;
  count: number;
}

export function TagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  function refresh() {
    return fetch("/api/tags")
      .then((r) => r.json())
      .then(setTags)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function rename(tag: string) {
    const to = await Prompt.call({
      title: `重命名「${tag}」`,
      defaultValue: tag,
      confirmLabel: "重命名",
    });
    if (!to || to === tag) return;
    try {
      await api("/api/tags/rename", { json: { from: tag, to } });
      toastSuccess("已重命名", { description: `「${tag}」→「${to}」`, id: "tag" });
    } catch (err) {
      toastError("重命名失败", err, { id: "tag" });
    }
    refresh();
  }

  async function remove(tag: string) {
    const ok = await Confirm.call({
      title: `删除标签「${tag}」？`,
      message: "会把这个标签从所有收藏上移除，收藏本身不会删除。",
      confirmLabel: "删除",
      danger: true,
    });
    if (!ok) return;
    try {
      await api("/api/tags/delete", { json: { tag } });
      toastSuccess("已删除标签", { description: tag, id: "tag" });
    } catch (err) {
      toastError("删除标签失败", err, { id: "tag" });
    }
    refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="font-heading font-semibold text-lg">标签</h1>

      {loading ? (
        <PageLoading />
      ) : tags.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>还没有标签</EmptyTitle>
            <EmptyDescription>给收藏打上标签，就能在这里统一管理。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid animate-fade-in gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map(({ tag, count }) => (
            <Card
              key={tag}
              className="flex items-center justify-between gap-2 p-3 shadow-none before:shadow-none dark:before:shadow-none"
            >
              <button
                type="button"
                onClick={() => navigate(`/?tag=${encodeURIComponent(tag)}`)}
                className="flex min-w-0 items-center gap-2 text-left"
              >
                <span className="truncate font-medium">#{tag}</span>
                <Badge variant="secondary" size="sm">
                  {count}
                </Badge>
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="重命名"
                  onClick={() => rename(tag)}
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="删除"
                  onClick={() => remove(tag)}
                  className="text-muted-foreground hover:text-destructive-foreground"
                >
                  <Trash2Icon />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Confirm />
      <Prompt />
    </div>
  );
}
