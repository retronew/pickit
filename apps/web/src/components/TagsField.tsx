import { useRef, useState } from "react";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "#components/ui/combobox";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}

// Base UI's Combobox (multiple + chips) only supports picking from a fixed
// `items` list. We extend it here so pressing Enter on text that isn't in
// the list creates a brand-new tag instead — the "creatable" behaviour this
// product needs but coss's particles (p-combobox-14 / p-field-9) don't ship.
export function TagsField({ tags, onChange, suggestions }: Props) {
  const [highlighted, setHighlighted] = useState<string | undefined>();
  const draftInputRef = useRef<HTMLInputElement>(null);
  const items = suggestions.filter((s) => !tags.includes(s));

  return (
    <Combobox
      items={items}
      multiple
      value={tags}
      onValueChange={(v) => onChange(v as string[])}
      onItemHighlighted={(v) => setHighlighted(v as string | undefined)}
    >
      <ComboboxChips>
        {tags.map((t) => (
          <ComboboxChip key={t} aria-label={t}>
            {t}
          </ComboboxChip>
        ))}
        <ComboboxChipsInput
          ref={draftInputRef}
          placeholder={tags.length ? undefined : "输入后回车添加，或从建议中选择"}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key !== "Enter" && e.key !== ",") return;
            // A highlighted suggestion means Base UI's own Enter handling
            // will select it — step aside so we don't double-add.
            if (highlighted) return;
            const el = draftInputRef.current;
            const raw = el?.value.trim();
            if (!raw) return;
            e.preventDefault();
            if (!tags.includes(raw)) onChange([...tags, raw]);
            if (el) {
              el.value = "";
              el.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }}
        />
      </ComboboxChips>
      <ComboboxPopup>
        <ComboboxEmpty>输入后回车即可创建新标签</ComboboxEmpty>
        <ComboboxList>
          {items.map((s) => (
            <ComboboxItem key={s} value={s}>
              {s}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
