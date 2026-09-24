import { Card } from "#components/ui/card";
import { cn } from "#lib/utils";
import { Hint } from "#components/Hint";

interface Props {
  label: string;
  value: string;
  /** Shown on hover, e.g. the exact time behind "5 minutes ago". */
  hint?: string;
  /** Smaller padding and number, for dialogs. */
  compact?: boolean;
}

/** A labelled key figure on a card, for rows of stats. */
export function StatTile({ label, value, hint, compact }: Props) {
  return (
    <Card className={cn("min-w-0 gap-0", compact ? "p-3" : "p-4")}>
      <p className="truncate text-muted-foreground text-xs">{label}</p>
      <Hint content={hint}>
        <p className={cn("w-fit max-w-full truncate font-heading font-semibold", compact ? "text-xl" : "text-2xl")}>
          {value}
        </p>
      </Hint>
    </Card>
  );
}
