import { useMemo } from "react";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "#components/ui/combobox";

export interface CategoryOption {
  value: string;
  count: number;
}

export function CategoryFilter({
  options,
  category,
  onChange,
}: {
  options: CategoryOption[];
  category: string;
  onChange: (category: string) => void;
}) {
  const items = useMemo(
    () => [
      { value: "", label: "全部分类", count: null as number | null },
      ...options.map((option) => ({ ...option, label: option.value })),
    ],
    [options],
  );
  const selected = items.find((item) => item.value === category) ?? items[0];

  return (
    <div className="w-30">
      <Combobox
        items={items}
        value={selected}
        onValueChange={(item) => onChange(item?.value ?? "")}
      >
        <ComboboxInput aria-label="筛选分类" placeholder="全部分类" size="sm" />
        <ComboboxPopup>
          <ComboboxEmpty>没有匹配的分类</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item.value} value={item}>
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate">{item.label}</span>
                  {item.count !== null && (
                    <span className="shrink-0 text-xs text-muted-foreground">{item.count}</span>
                  )}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
    </div>
  );
}
