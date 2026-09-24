import { api, toastError, toastSuccess } from "#lib/api";
import { shareAndCopy } from "#lib/shares";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { TagCard } from "#components/tags/TagCard";
import { WindowVirtualList } from "#components/WindowVirtualList";
import { useMediaQuery } from "#hooks/use-media-query";
import { chunk } from "#lib/chunk";
import { cn } from "#lib/utils";
import { Confirm } from "#components/Confirm";
import { Prompt } from "#components/Prompt";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "#components/ui/empty";
import { PageLoading } from "#components/PageLoading";
import { m } from "#lib/i18n";

interface TagRow {
  tag: string;
  count: number;
}

export function TagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  // Virtualized rows need the column count in JS; matches the old lg:grid-cols-3.
  const columns = useMediaQuery("lg") ? 3 : 2;
  const rows = useMemo(() => chunk(tags, columns), [tags, columns]);

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
      title: m.tag_rename_title({ tag }),
      defaultValue: tag,
      confirmLabel: m.action_rename(),
    });
    if (!to || to === tag) return;
    try {
      await api("/api/tags/rename", { json: { from: tag, to } });
      toastSuccess(m.tag_renamed(), { description: `「${tag}」→「${to}」`, id: "tag" });
    } catch (err) {
      toastError(m.tag_rename_failed(), err, { id: "tag" });
    }
    refresh();
  }

  async function remove(tag: string) {
    const ok = await Confirm.call({
      title: m.tag_delete_title({ tag }),
      message: m.tag_delete_message(),
      confirmLabel: m.action_delete(),
      danger: true,
    });
    if (!ok) return;
    try {
      await api("/api/tags/delete", { json: { tag } });
      toastSuccess(m.tag_deleted(), { description: tag, id: "tag" });
    } catch (err) {
      toastError(m.tag_delete_failed(), err, { id: "tag" });
    }
    refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="font-heading font-semibold text-lg">{m.nav_tags()}</h1>

      {loading ? (
        <PageLoading />
      ) : tags.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>{m.tags_empty()}</EmptyTitle>
            <EmptyDescription>{m.tags_empty_hint()}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="animate-fade-in">
          <WindowVirtualList
            rows={rows}
            getKey={(row) => row[0].tag}
            estimateSize={() => (columns === 3 ? 58 : 84)}
            renderRow={(row) => (
              <div className={cn("grid gap-2 pb-2", columns === 3 ? "grid-cols-3" : "grid-cols-2")}>
                {row.map(({ tag, count }) => (
                  <TagCard
                    key={tag}
                    tag={tag}
                    count={count}
                    onOpen={() => navigate(`/?tag=${encodeURIComponent(tag)}`)}
                    onShare={() => shareAndCopy("tag", tag)}
                    onRename={() => rename(tag)}
                    onDelete={() => remove(tag)}
                  />
                ))}
              </div>
            )}
          />
        </div>
      )}

      <Confirm />
      <Prompt />
    </div>
  );
}
