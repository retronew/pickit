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
import { m } from "#lib/i18n";

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
            <DialogTitle>{adding ? m.tags_add_title() : m.tags_remove_title()}</DialogTitle>
            <DialogDescription>
              {adding
                ? m.tags_add_hint({ count })
                : m.tags_remove_hint({ count })}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <TagsField tags={tags} onChange={setTags} suggestions={suggestions} />
          </DialogPanel>
          <DialogFooter>
            <Button variant="ghost" onClick={() => call.end(null)}>
              {m.common_cancel()}
            </Button>
            <Button
              variant={adding ? "default" : "destructive"}
              disabled={tags.length === 0}
              onClick={() => call.end(tags)}
            >
              {adding ? m.tags_add_button({ count: tags.length }) : m.tags_remove_button({ count: tags.length })}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    );
  },
  200,
);
