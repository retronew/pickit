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
  id?: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  empty: string;
  /** How an option is shown, e.g. with a leading "#". */
  format?: (option: string) => string;
}

/** Picks several values from a fixed list, shown as removable chips. */
export function MultiSelectField({ id, options, value, onChange, placeholder, empty, format = (o) => o }: Props) {
  return (
    <Combobox items={options} multiple value={value} onValueChange={(v) => onChange(v as string[])}>
      <ComboboxChips>
        {value.map((v) => (
          <ComboboxChip key={v} aria-label={format(v)}>
            {format(v)}
          </ComboboxChip>
        ))}
        <ComboboxChipsInput id={id} placeholder={value.length ? undefined : placeholder} />
      </ComboboxChips>
      <ComboboxPopup>
        <ComboboxEmpty>{empty}</ComboboxEmpty>
        <ComboboxList>
          {(option: string) => (
            <ComboboxItem key={option} value={option}>
              {format(option)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
