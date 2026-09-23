import { Skeleton } from "#components/ui/skeleton";
import { cn } from "#lib/utils";

// Placeholders shaped like the settings cards' real content, so the layout
// doesn't jump when data arrives. Real content then fades in (animate-fade-in).

/** Rows like a card's item list (emails, shares…). */
export function ListSkeleton({ rows = 2, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-1", className)} aria-busy="true" aria-label="加载中">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5">
          <Skeleton className="h-4" style={{ width: `${60 - i * 12}%` }} />
          <Skeleton className="size-5 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** A label + input pair. */
export function FieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-9 w-full rounded-lg" />
    </div>
  );
}

/** One line of text. */
export function TextSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-4 w-40", className)} />;
}

/** Button-sized blocks for a card footer. */
export function ButtonsSkeleton({ widths = ["w-20"] }: { widths?: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {widths.map((w, i) => (
        <Skeleton key={i} className={cn("h-9 rounded-lg", w)} />
      ))}
    </div>
  );
}
