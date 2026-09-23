// Model picker: fetched list with free text entry.

import { useState } from "react";
import { Field, FieldLabel, FieldDescription } from "#components/ui/field";
import { Button } from "#components/ui/button";
import {
  Autocomplete,
  AutocompleteInput,
  AutocompletePopup,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
} from "#components/ui/autocomplete";
import type { Target, ModelState } from "./shared";

export function ModelField({
  target,
  value,
  placeholder,
  state,
  canFetch,
  fetchLabel,
  onFetch,
  onChange,
}: {
  target: Target;
  value: string;
  placeholder: string;
  state: ModelState;
  canFetch: boolean;
  fetchLabel: string;
  onFetch: () => void;
  onChange: (value: string) => void;
}) {
  const preferred = state.models.filter((m) => m.kind === target).map((m) => m.id);
  const items = preferred.length ? preferred : state.models.map((m) => m.id);
  // Show the full list when the popup opens; filter only once the user edits
  // the input. Otherwise a selected model filters the list down to itself.
  const [openedWith, setOpenedWith] = useState<string | null>(null);
  const query = value.trim().toLowerCase();
  const filteredItems =
    openedWith === value || !query ? items : items.filter((id) => id.toLowerCase().includes(query));
  return (
    <Field>
      <FieldLabel htmlFor={`${target}-model`}>模型</FieldLabel>
      <div className="flex gap-2">
        <Autocomplete
          items={items}
          filteredItems={filteredItems}
          value={value}
          onValueChange={(v) => onChange(v)}
          onOpenChange={(open) => setOpenedWith(open ? value : null)}
          openOnInputClick
        >
          <AutocompleteInput
            id={`${target}-model`}
            size="lg"
            className="font-mono"
            placeholder={placeholder}
            showTrigger={items.length > 0}
          />
          <AutocompletePopup>
            <AutocompleteEmpty>没有匹配的模型，可以直接输入</AutocompleteEmpty>
            <AutocompleteList>
              {(item: string) => (
                <AutocompleteItem key={item} value={item} className="font-mono">
                  {item}
                </AutocompleteItem>
              )}
            </AutocompleteList>
          </AutocompletePopup>
        </Autocomplete>
        <Button
          variant="outline"
          size="lg"
          className="shrink-0"
          disabled={!canFetch || state.loading}
          onClick={onFetch}
        >
          {state.loading ? "获取中…" : fetchLabel}
        </Button>
      </div>
      <FieldDescription>
        可以从获取到的列表里选，也可以直接手动输入模型名称。
      </FieldDescription>
      {state.message && (
        <p className={state.error ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
          {state.message}
        </p>
      )}
    </Field>
  );
}
