import type { ReactNode } from "react";

/**
 * Two independent stacks of cards (one stack on narrow screens). Unlike a
 * two-column grid, a short card doesn't leave a gap: each column only stacks
 * its own cards instead of aligning rows to the tallest one.
 */
export function CardColumns({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="space-y-6">{left}</div>
      <div className="space-y-6">{right}</div>
    </div>
  );
}
