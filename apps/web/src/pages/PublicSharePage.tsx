import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Streamdown } from "streamdown";
import { ExternalLinkIcon } from "lucide-react";
import { Card } from "#components/ui/card";
import { Badge } from "#components/ui/badge";
import { Favicon } from "#components/Favicon";

interface SharedItem {
  name: string;
  url: string;
  icon: string;
  note: string;
  category: string;
  tags: string[];
}

export function PublicSharePage() {
  const { slug } = useParams();
  const [item, setItem] = useState<SharedItem | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/shares/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError("这个分享链接不存在或已失效。");
          return;
        }
        setItem(data.item);
        setTitle(data.title);
      })
      .catch(() => setError("加载失败，请稍后再试。"));
  }, [slug]);

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center px-4 py-12">
      <div className="w-full space-y-4">
        <div className="text-center">
          <span className="font-heading font-bold tracking-tight">PickIt</span>
          <p className="text-muted-foreground text-xs">来自朋友的分享</p>
        </div>

        {error && (
          <p className="text-center text-muted-foreground text-sm">{error}</p>
        )}

        {item && (
          <Card className="p-5">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 font-medium text-lg hover:underline"
            >
              <Favicon url={item.url} name={item.name} />
              {title || item.name}
              <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
            </a>
            {item.note && (
              <div className="mt-2 text-muted-foreground text-sm leading-relaxed">
                <Streamdown>{item.note}</Streamdown>
              </div>
            )}
            {(item.category || item.tags.length > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {item.category && (
                  <Badge variant="outline" size="sm">
                    {item.category}
                  </Badge>
                )}
                {item.tags.map((t) => (
                  <Badge key={t} variant="secondary" size="sm">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
