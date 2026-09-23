import { useState } from "react";
import { XIcon, PinIcon, PinOffIcon, Trash2Icon, FolderIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "#components/ui/select";

export function BulkActionBar({
  count,
  categories,
  onPin,
  onUnpin,
  onDelete,
  onMoveCategory,
  onCancel,
}: {
  count: number;
  categories: string[];
  onPin: () => void;
  onUnpin: () => void;
  onDelete: () => void;
  onMoveCategory: (category: string) => void;
  onCancel: () => void;
}) {
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="sticky top-17 z-40 flex flex-wrap items-center gap-2 rounded-xl border bg-popover/95 not-dark:bg-clip-padding px-3 py-2 shadow-lg/10 backdrop-blur">
      <span className="text-sm font-medium">已选 {count} 项</span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onPin}>
          <PinIcon />
          置顶
        </Button>
        <Button variant="outline" size="sm" onClick={onUnpin}>
          <PinOffIcon />
          取消置顶
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
              <SelectValue placeholder="移到分类" />
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
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2Icon />
          删除
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="取消选择"
          onClick={onCancel}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
