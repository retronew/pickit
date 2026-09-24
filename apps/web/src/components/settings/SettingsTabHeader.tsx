import type { ReactNode } from "react";

/** A settings tab's description, with optional controls on the same line (e.g. refresh). */
export function SettingsTabHeader({ description, actions }: { description: string; actions?: ReactNode }) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-muted-foreground text-sm">{description}</p>
      {actions}
    </div>
  );
}
