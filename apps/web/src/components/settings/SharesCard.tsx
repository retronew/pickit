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
import { m } from "#lib/i18n";

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
      toastSuccess(m.share_revoked(), { id: "share" });
    } catch (err) {
      toastError(m.share_revoke_failed(), err, { id: "share" });
    }
    refresh();
  }

  async function copy(slug: string) {
    await copyText(`${window.location.origin}/s/${slug}`, m.share_link_copied());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.shares_title()}</CardTitle>
        <CardDescription>
          {m.shares_description()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {shares === null ? (
          <ListSkeleton rows={2} />
        ) : shares.length === 0 ? (
          <p className="animate-fade-in text-muted-foreground text-sm">{m.shares_none()}</p>
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
                      aria-label={m.shares_copy_rss()}
                      title={m.shares_copy_rss()}
                      onClick={() => copyText(rssUrl(s.slug), m.shares_rss_copied())}
                    >
                      <RssIcon />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={m.shares_copy_link()}
                    onClick={() => copy(s.slug)}
                  >
                    <CopyIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={m.shares_revoke()}
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
