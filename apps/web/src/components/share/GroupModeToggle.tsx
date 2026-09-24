import { FolderIcon, HashIcon, LayoutGridIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "#components/ui/toggle-group";
import type { GroupMode } from "#lib/group-items";
import { m } from "#lib/i18n";

const OPTIONS: { mode: GroupMode; icon: React.ReactNode; label: () => string }[] = [
  { mode: "flat", icon: <LayoutGridIcon />, label: m.public_view_flat },
  { mode: "category", icon: <FolderIcon />, label: m.public_view_category },
  { mode: "tag", icon: <HashIcon />, label: m.public_view_tag },
];

/** Switches a list between flat, by category and by tag. */
export function GroupModeToggle({ value, onChange }: { value: GroupMode; onChange: (mode: GroupMode) => void }) {
  return (
    <ToggleGroup
      aria-label={m.public_view_label()}
      variant="outline"
      size="sm"
      value={[value]}
      onValueChange={(v) => v[0] && onChange(v[0] as GroupMode)}
    >
      {OPTIONS.map((o) => (
        <ToggleGroupItem key={o.mode} value={o.mode} aria-label={o.label()} className="sm:px-2.5">
          {o.icon}
          <span className="max-sm:hidden">{o.label()}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
