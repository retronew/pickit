import { useEffect, useState } from "react";
import { createCallable } from "react-call";
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
import { TagsField } from "#components/items/TagsField";

interface Props {
  mode: "add" | "remove";
  count: number;
  /** Tags to suggest: all tags for "add", the selection's tags for "remove". */
  suggestions: string[];
}

/** Picks tags to add to / remove from the selected items. */
export const TagsEditDialog = createCallable<Props, string[] | null>(
  ({ mode, count, suggestions, call }) => {
    const [entered, setEntered] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    useEffect(() => {
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }, []);

    const adding = mode === "add";
    return (
      <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && call.end(null)}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{adding ? "批量添加标签" : "批量移除标签"}</DialogTitle>
            <DialogDescription>
              {adding
                ? `给选中的 ${count} 项加上这些标签，已有的不会重复。`
                : `从选中的 ${count} 项里移除这些标签。`}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <TagsField tags={tags} onChange={setTags} suggestions={suggestions} />
          </DialogPanel>
          <DialogFooter>
            <Button variant="ghost" onClick={() => call.end(null)}>
              取消
            </Button>
            <Button
              variant={adding ? "default" : "destructive"}
              disabled={tags.length === 0}
              onClick={() => call.end(tags)}
            >
              {adding ? "添加" : "移除"} {tags.length > 0 && `${tags.length} 个标签`}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    );
  },
  200,
);
