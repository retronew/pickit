// Model picker: fetched list with free text entry.

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
import { useSuggestionFilter } from "#hooks/useSuggestionFilter";
import type { Target, ModelState } from "./shared";
import { m } from "#lib/i18n";

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
  const preferred = state.models.filter((model) => model.kind === target).map((model) => model.id);
  const items = preferred.length ? preferred : state.models.map((model) => model.id);
  const { filteredItems, onOpenChange } = useSuggestionFilter(items, value);
  return (
    <Field>
      <FieldLabel htmlFor={`${target}-model`}>{m.ai_model()}</FieldLabel>
      <div className="flex gap-2">
        <Autocomplete
          items={items}
          filteredItems={filteredItems}
          value={value}
          onValueChange={(v) => onChange(v)}
          onOpenChange={onOpenChange}
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
            <AutocompleteEmpty>{m.ai_model_none()}</AutocompleteEmpty>
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
          {state.loading ? m.ai_fetching() : fetchLabel}
        </Button>
      </div>
      <FieldDescription>
        {m.ai_model_hint()}
      </FieldDescription>
      {state.message && (
        <p className={state.error ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
          {state.message}
        </p>
      )}
    </Field>
  );
}
