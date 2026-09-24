import { useState } from "react";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "#components/ui/combobox";
import { m } from "#lib/i18n";

export interface TagOption {
  value: string;
  count: number;
}

export function TagFilter({
  options,
  selected,
  onChange,
}: {
  options: TagOption[];
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const values = options.map((option) => option.value);
  const counts = new Map(options.map((option) => [option.value, option.count]));

  return (
    <div className="min-w-0 max-sm:flex-1 sm:w-26">
      <Combobox
        items={values}
        multiple
        open={open}
        value={selected}
        onOpenChange={(nextOpen, details) => {
          if (!nextOpen && details.reason === "item-press") return;
          setOpen(nextOpen);
        }}
        onValueChange={onChange}
      >
        <ComboboxInput
          aria-label={m.filter_tag_label()}
          placeholder={selected.length ? `${m.field_tags()} · ${selected.length}` : m.field_tags()}
          size="sm"
        />
        <ComboboxPopup>
          <ComboboxEmpty>{m.filter_no_tag()}</ComboboxEmpty>
          <ComboboxList>
            {(tag) => (
              <ComboboxItem key={tag} value={tag}>
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate">#{tag}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{counts.get(tag)}</span>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
    </div>
  );
}
