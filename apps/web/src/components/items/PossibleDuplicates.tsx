import type { PossibleDuplicate } from "#hooks/useUrlAnalyzer";

/** Warning listing saved items that look like the URL being added. */
export function PossibleDuplicates({ items }: { items: PossibleDuplicate[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-warning/4 space-y-1 rounded-md border border-warning/32 p-2 text-xs">
      <p className="text-warning-foreground font-medium">
        这个链接和你已收藏的内容很像，可能是同一个东西：
      </p>
      {items.map((d) => (
        <a
          key={d.id}
          href={d.url}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground block truncate underline-offset-2 hover:underline"
        >
          {d.name}
          {d.category ? `（${d.category}）` : ""} · 相似度 {Math.round(d.score * 100)}%
        </a>
      ))}
    </div>
  );
}
