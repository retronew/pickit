import { useEffect, useState } from "react";
import { createCallable } from "react-call";
import { CheckIcon, FolderIcon, HomeIcon } from "lucide-react";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "#components/ui/dialog";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import type { CategoryNode } from "#lib/categories";
import { m } from "#lib/i18n";
import { cn } from "#lib/utils";

interface Props {
  title: string;
  description?: string;
  nodes: CategoryNode[];
  /** Categories that can't be picked (shown dimmed). */
  disabled: (category: string) => boolean;
  /** Offer "top level" as a target (resolves to ""). */
  allowTop?: boolean;
  confirmLabel: string;
}

function Option({
  label,
  icon,
  depth = 0,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  depth?: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-md py-1.5 pe-2 text-left text-sm [&_svg]:size-4 [&_svg]:shrink-0",
        selected ? "bg-accent font-medium" : "hover:bg-accent/50",
        disabled && "pointer-events-none opacity-40",
      )}
      style={{ paddingInlineStart: `${0.5 + depth * 1.25}rem` }}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected && <CheckIcon />}
    </button>
  );
}

/** Picks a target category from the tree. Resolves to its path, "" for top level, or null. */
export const CategoryPickerDialog = createCallable<Props, string | null>(
  ({ title, description, nodes, disabled, allowTop, confirmLabel, call }) => {
    const [entered, setEntered] = useState(false);
    const [query, setQuery] = useState("");
    const [target, setTarget] = useState<string | null>(null);

    useEffect(() => {
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }, []);

    const q = query.trim().toLowerCase();
    // While filtering, show matches with their full path instead of the indented tree.
    const shown = q ? nodes.filter((n) => n.category.toLowerCase().includes(q)) : nodes;

    return (
      <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && call.end(null)}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <DialogPanel className="space-y-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={m.category_picker_search()}
              aria-label={m.category_picker_search()}
            />
            <div role="listbox" aria-label={title} className="max-h-72 overflow-y-auto">
              {allowTop && !q && (
                <Option
                  label={m.category_top_level()}
                  icon={<HomeIcon />}
                  selected={target === ""}
                  disabled={disabled("")}
                  onSelect={() => setTarget("")}
                />
              )}
              {shown.map((n) => (
                <Option
                  key={n.category}
                  label={q ? n.category : n.name}
                  icon={<FolderIcon />}
                  depth={q ? 0 : n.depth + (allowTop ? 1 : 0)}
                  selected={target === n.category}
                  disabled={disabled(n.category)}
                  onSelect={() => setTarget(n.category)}
                />
              ))}
              {shown.length === 0 && <p className="py-4 text-center text-muted-foreground text-sm">{m.share_pick_none()}</p>}
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button variant="outline" onClick={() => call.end(null)}>
              {m.common_cancel()}
            </Button>
            <Button onClick={() => call.end(target)} disabled={target === null}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    );
  },
  200,
);
