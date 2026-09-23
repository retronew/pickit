import { Spinner } from "#components/ui/spinner";

export function PageLoading() {
  return (
    <div className="flex min-h-40 animate-fade-in items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
      <Spinner className="size-4" />
      加载中…
    </div>
  );
}
