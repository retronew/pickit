import { useState } from "react";
import {
  XIcon,
  PinIcon,
  PinOffIcon,
  Trash2Icon,
  FolderIcon,
  TagsIcon,
  PlusIcon,
  MinusIcon,
  SparklesIcon,
  TextQuoteIcon,
} from "lucide-react";
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "#components/ui/menu";
import { Button } from "#components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "#components/ui/select";
import { m } from "#lib/i18n";

export function BulkActionBar({
  count,
  categories,
  onPin,
  onUnpin,
  onDelete,
  onMoveCategory,
  onEditTags,
  onAiOrganize,
  onSummarize,
  onCancel,
}: {
  count: number;
  categories: string[];
  onPin: () => void;
  onUnpin: () => void;
  onDelete: () => void;
  onMoveCategory: (category: string) => void;
  onEditTags: (mode: "add" | "remove") => void;
  onAiOrganize: () => void;
  onSummarize: () => void;
  onCancel: () => void;
}) {
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="sticky top-17 z-40 flex flex-wrap items-center gap-2 rounded-xl border bg-popover/95 not-dark:bg-clip-padding px-3 py-2 shadow-lg/10 backdrop-blur">
      <span className="text-sm font-medium">{m.bulk_selected({ count })}</span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onPin}>
          <PinIcon />
          <span className="max-sm:sr-only">{m.action_pin()}</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onUnpin}>
          <PinOffIcon />
          <span className="max-sm:sr-only">{m.action_unpin()}</span>
        </Button>
        {categories.length > 0 && (
          <Select
            key={resetKey}
            onValueChange={(v) => {
              onMoveCategory(v as string);
              setResetKey((k) => k + 1);
            }}
          >
            <SelectTrigger size="sm" className="w-auto min-w-0">
              <FolderIcon className="size-4" />
              <SelectValue placeholder={m.bulk_move_category()} />
            </SelectTrigger>
            <SelectPopup>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        )}
        <Menu>
          <MenuTrigger render={<Button variant="outline" size="sm" />}>
            <TagsIcon />
            <span className="max-sm:sr-only">{m.bulk_tags()}</span>
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={() => onEditTags("add")}>
              <PlusIcon />
              {m.bulk_add_tags()}
            </MenuItem>
            <MenuItem onClick={() => onEditTags("remove")}>
              <MinusIcon />
              {m.bulk_remove_tags()}
            </MenuItem>
          </MenuPopup>
        </Menu>
        <Button variant="outline" size="sm" onClick={onSummarize}>
          <TextQuoteIcon />
          <span className="max-sm:sr-only">{m.bulk_summarize()}</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onAiOrganize}>
          <SparklesIcon />
          <span className="max-sm:sr-only">{m.bulk_ai_organize()}</span>
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2Icon />
          <span className="max-sm:sr-only">{m.action_delete()}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={m.bulk_cancel()}
          onClick={onCancel}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
