import { Spinner } from "#components/ui/spinner";
import { m } from "#lib/i18n";

export function PageLoading() {
  return (
    <div className="flex min-h-40 animate-fade-in items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
      <Spinner className="size-4" />
      {m.common_loading()}
    </div>
  );
}
