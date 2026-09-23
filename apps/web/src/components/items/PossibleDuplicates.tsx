import type { PossibleDuplicate } from "#hooks/useUrlAnalyzer";
import { m } from "#lib/i18n";

/** Warning listing saved items that look like the URL being added. */
export function PossibleDuplicates({ items }: { items: PossibleDuplicate[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-warning/4 space-y-1 rounded-md border border-warning/32 p-2 text-xs">
      <p className="text-warning-foreground font-medium">
        {m.dup_similar()}
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
          {d.category ? `（${d.category}）` : ""} · {m.dup_similarity({ percent: Math.round(d.score * 100) })}
        </a>
      ))}
    </div>
  );
}
