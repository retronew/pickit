import { cn } from "#lib/utils";

/** One-line status under the search box: searching, error or result count. */
export function SearchStatus({
  query,
  searching,
  error,
  hasHits,
  count,
}: {
  query: string;
  searching: boolean;
  error: string;
  hasHits: boolean;
  count: number;
}) {
  const q = query.trim();
  if (!q) return null;
  return (
    <p role="status" className={cn("-mt-2 text-xs", error ? "text-destructive" : "text-muted-foreground")}>
      {searching
        ? `正在搜索「${q}」…`
        : error
          ? `搜索失败：${error}`
          : hasHits
            ? `找到 ${count} 条相关收藏，按相关度排序`
            : null}
    </p>
  );
}
