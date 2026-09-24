import { api, toastError, toastSuccess } from "#lib/api";
import { shareAndCopy } from "#lib/shares";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { TagCard } from "#components/tags/TagCard";
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
        <div className="grid animate-fade-in grid-cols-2 gap-2 lg:grid-cols-3">
          {tags.map(({ tag, count }) => (
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

      <Confirm />
      <Prompt />
    </div>
  );
}
