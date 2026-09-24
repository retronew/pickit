import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { RssIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { Skeleton } from "#components/ui/skeleton";
import { SharedItemCard, type SharedItem } from "#components/share/SharedItemCard";
import { api } from "#lib/api";
import { SHARE_TYPE_LABELS } from "#lib/shares";
import { m } from "#lib/i18n";

type Shared =
  | { type: "item"; title: string; item: SharedItem }
  | { type: "category" | "tag" | "collection"; title: string; value: string; items: SharedItem[] };

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
  const { slug } = useParams();
  const [data, setData] = useState<Shared | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Shared>(`/api/public/shares/${slug}`)
      .then((d) => {
        setData(d);
        document.title = `${d.title} · PickIt`;
      })
      .catch((err) =>
        setError(err?.status === 404 ? m.public_not_found() : m.public_load_failed()),
      );
  }, [slug]);

  const isList = data && data.type !== "item";
  const feed = isList ? `/api/public/shares/${slug}/rss` : null;
  useFeedLink(feed, data?.title ?? "");

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col px-4 py-12">
      <div className="w-full space-y-5">
        <div className="text-center">
          <span className="font-heading font-bold tracking-tight">PickIt</span>
          <p className="text-muted-foreground text-xs">{m.public_from_friend()}</p>
        </div>

        {error && <p className="text-center text-muted-foreground text-sm">{error}</p>}
        {!data && !error && <LoadingCards />}

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
              <Button variant="outline" size="sm" render={<a href={feed!} target="_blank" rel="noreferrer" />}>
                <RssIcon />
                {m.public_rss()}
              </Button>
            </div>
            {data.items.length === 0 ? (
              <p className="text-muted-foreground text-sm">{m.public_empty()}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.items.map((item) => (
                  <SharedItemCard key={`${item.url}-${item.name}`} item={item} compact />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
