import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "#components/ui/select";
import { Field, FieldLabel } from "#components/ui/field";
import { useShareTargets } from "#hooks/useShareTargets";
import { SHARE_TYPE_LABELS } from "#lib/shares";
import { m } from "#lib/i18n";

export type PickableType = "category" | "tag";

interface Props {
  type: PickableType;
  value: string;
  onTypeChange: (type: PickableType) => void;
  onValueChange: (value: string) => void;
}

/** Picks a whole category or tag to share. */
export function ShareTargetPicker({ type, value, onTypeChange, onValueChange }: Props) {
  const { categories, tags } = useShareTargets(true);
  const options = (type === "category" ? categories : tags) ?? [];
  const typeItems = { category: SHARE_TYPE_LABELS.category, tag: SHARE_TYPE_LABELS.tag };
  const valueItems = Object.fromEntries(options.map((o) => [o, type === "tag" ? `#${o}` : o]));

  return (
    <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
      <Field>
        <FieldLabel>{m.share_pick_type()}</FieldLabel>
        <Select
          value={type}
          items={typeItems}
          onValueChange={(v) => {
            if (!v) return;
            onTypeChange(v as PickableType);
            onValueChange("");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {(Object.keys(typeItems) as PickableType[]).map((k) => (
              <SelectItem key={k} value={k}>
                {typeItems[k]}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </Field>
      <Field>
        <FieldLabel>{type === "category" ? m.share_pick_category() : m.share_pick_tag()}</FieldLabel>
        <Select value={value || null} items={valueItems} onValueChange={(v) => onValueChange((v as string) ?? "")}>
          <SelectTrigger disabled={options.length === 0}>
            <SelectValue placeholder={options.length ? m.share_pick_placeholder() : m.share_pick_none()} />
          </SelectTrigger>
          <SelectPopup>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {valueItems[o]}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </Field>
    </div>
  );
}
