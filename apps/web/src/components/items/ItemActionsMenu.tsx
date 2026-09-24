import { PencilIcon, PinIcon, PinOffIcon, Trash2Icon } from "lucide-react";
import type { Item } from "#hooks/useItems";
import { Menu, MenuPopup, MenuItem, MenuSeparator } from "#components/ui/menu";
import { m } from "#lib/i18n";

export interface ItemActionsTarget {
  item: Item;
  anchor: HTMLElement;
}

/**
 * Pin / edit / delete for an item card on phones. One instance serves the
 * whole list, anchored to whichever card's button opened it: a Menu per card
 * would make mounting 600+ cards slow.
 */
export function ItemActionsMenu({
  target,
  onClose,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  target: ItemActionsTarget | null;
  onClose: () => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onTogglePin: (item: Item) => void;
}) {
  const item = target?.item;
  return (
    <Menu open={!!target} onOpenChange={(open) => !open && onClose()}>
      {item && (
        <MenuPopup anchor={target.anchor} align="end">
          <MenuItem onClick={() => onTogglePin(item)}>
            {item.pinned ? <PinOffIcon /> : <PinIcon />}
            {item.pinned ? m.action_unpin() : m.action_pin()}
          </MenuItem>
          <MenuItem onClick={() => onEdit(item)}>
            <PencilIcon />
            {m.action_edit()}
          </MenuItem>
          <MenuSeparator />
          <MenuItem variant="destructive" onClick={() => onDelete(item)}>
            <Trash2Icon />
            {m.action_delete()}
          </MenuItem>
        </MenuPopup>
      )}
    </Menu>
  );
}
