import { useEffect } from "react";
import { useParams } from "react-router";
import { RssIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { Skeleton } from "#components/ui/skeleton";
import { SharedItemCard } from "#components/share/SharedItemCard";
import { SharedItemList } from "#components/share/SharedItemList";
import { SharePasswordForm } from "#components/share/SharePasswordForm";
import { GroupModeToggle } from "#components/share/GroupModeToggle";
import { useGroupMode } from "#hooks/useGroupMode";
import { usePublicShare } from "#hooks/usePublicShare";
import { SHARE_TYPE_LABELS } from "#lib/shares";
import { m } from "#lib/i18n";

/** Advertises the RSS feed to browsers and feed readers while the page is open. */
function useFeedLink(href: string | null, title: string) {
  useEffect(() => {
    if (!href) return;
    const link = document.createElement("link");
    link.rel = "alternate";
    link.type = "application/rss+xml";
    link.title = title;
    link.href = href;
    document.head.append(link);
    return () => link.remove();
  }, [href, title]);
}

function LoadingCards() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2 rounded-2xl border p-5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

export function PublicSharePage() {
  const { slug = "" } = useParams();
  const { state, key, unlock } = usePublicShare(slug);
  const { mode, setMode } = useGroupMode("pickit.share-view");
  const data = state.status === "ready" ? state.data : null;
  const error =
    state.status === "missing"
      ? m.public_not_found()
      : state.status === "expired"
        ? m.public_expired()
        : state.status === "failed"
          ? m.public_load_failed()
          : "";

  const isList = data && data.type !== "item";
  // A protected feed carries its key, so feed readers can fetch it on their own.
  const feed = isList ? `/api/public/shares/${slug}/rss${key ? `?key=${key}` : ""}` : null;
  useFeedLink(feed, data?.title ?? "");

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col px-4 py-12">
      <div className="w-full space-y-5">
        <div className="text-center">
          <span className="font-heading font-bold tracking-tight">PickIt</span>
          <p className="text-muted-foreground text-xs">{m.public_from_friend()}</p>
        </div>

        {error && <p className="text-center text-muted-foreground text-sm">{error}</p>}
        {state.status === "loading" && <LoadingCards />}
        {state.status === "locked" && <SharePasswordForm onUnlock={unlock} />}

        {data?.type === "item" && (
          <div className="mx-auto max-w-lg animate-fade-in">
            <SharedItemCard item={data.item} title={data.title} />
          </div>
        )}

        {data && data.type !== "item" && (
          <div className="animate-fade-in space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h1 className="font-heading font-semibold text-xl">{data.title}</h1>
                <p className="text-muted-foreground text-sm">
                  {SHARE_TYPE_LABELS[data.type]} · {m.items_total({ count: data.items.length })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {data.items.length > 0 && <GroupModeToggle value={mode} onChange={setMode} />}
                <Button variant="outline" size="sm" render={<a href={feed!} target="_blank" rel="noreferrer" />}>
                  <RssIcon />
                  {m.public_rss()}
                </Button>
              </div>
            </div>
            {data.items.length === 0 ? (
              <p className="text-muted-foreground text-sm">{m.public_empty()}</p>
            ) : (
              <SharedItemList items={data.items} mode={mode} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
