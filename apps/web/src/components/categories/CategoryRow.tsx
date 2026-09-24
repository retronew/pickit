import {
  CornerDownRightIcon,
  FolderIcon,
  GitMergeIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "#components/ui/menu";
import { Hint } from "#components/Hint";
import { MarqueeText } from "#components/MarqueeText";
import { useCategoryDrag } from "#components/categories/CategoryDnd";
import type { CategoryNode } from "#lib/categories";
import { m } from "#lib/i18n";
import { cn } from "#lib/utils";

interface Props {
  node: CategoryNode;
  onOpen: () => void;
  onShare: () => void;
  onRename: () => void;
  onMove: () => void;
  onMerge: () => void;
  onDelete: () => void;
}

/**
 * One category in the tree: drag handle, indented name, bookmark count, share
 * and a menu of edits. Dropping another category on the row moves it inside.
 */
export function CategoryRow({ node, onOpen, onShare, onRename, onMove, onMerge, onDelete }: Props) {
  const nested = node.total !== node.count;
  const drag = useCategoryDrag(node);

  return (
    <div
      ref={drag.dropRef}
      className={cn(
        "flex items-center gap-2 rounded-lg py-1.5 pe-1 transition-colors hover:bg-accent/50",
        drag.isDragging && "opacity-40",
        drag.blocked && "opacity-50",
        drag.isOver && "bg-accent ring-2 ring-primary/40",
      )}
      style={{ paddingInlineStart: `${0.25 + node.depth * 1.25}rem` }}
    >
      <button
        type="button"
        aria-label={m.category_drag({ category: node.name })}
        className="shrink-0 cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
        {...drag.handle}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
        <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
        <MarqueeText className="font-medium">{node.name}</MarqueeText>
      </button>
      <Hint content={nested ? m.category_count_hint({ count: node.count, total: node.total }) : undefined}>
        <Badge variant="secondary" size="sm" className="shrink-0 tabular-nums">
          {node.total}
        </Badge>
      </Hint>
      <div className="flex shrink-0 items-center gap-0.5">
        <Hint content={m.category_share()}>
          <Button variant="ghost" size="icon-xs" aria-label={m.category_share()} onClick={onShare}>
            <Share2Icon />
          </Button>
        </Hint>
        <Menu>
          <MenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={m.category_more()} />}>
            <MoreHorizontalIcon />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={onRename}>
              <PencilIcon />
              {m.category_rename()}
            </MenuItem>
            <MenuItem onClick={onMove}>
              <CornerDownRightIcon />
              {m.category_move_to()}
            </MenuItem>
            <MenuItem onClick={onMerge}>
              <GitMergeIcon />
              {m.category_merge_to()}
            </MenuItem>
            <MenuSeparator />
            <MenuItem variant="destructive" onClick={onDelete}>
              <Trash2Icon />
              {m.action_delete()}
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
    </div>
  );
}
