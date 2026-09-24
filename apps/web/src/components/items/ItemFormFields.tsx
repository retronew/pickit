import { SparklesIcon } from "lucide-react";
import { Field, FieldLabel } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { Textarea } from "#components/ui/textarea";
import { Button } from "#components/ui/button";
import {
  Combobox,
  ComboboxInput,
  ComboboxPopup,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "#components/ui/combobox";
import { TagsField } from "#components/items/TagsField";
import { PossibleDuplicates } from "#components/items/PossibleDuplicates";
import { useUrlAnalyzer, type PossibleDuplicate } from "#hooks/useUrlAnalyzer";
import { m } from "#lib/i18n";

export interface ItemFormPayload {
  name: string;
  url: string;
  icon: string;
  /** Preview image from "AI analyze"; not an editable field. */
  image: string;
  note: string;
  category: string;
  tags: string[];
}

/**
 * The bookmark fields (URL + AI analyze, name, note, category, tags), shared
 * by the add / edit dialog and batch add's review step. Controlled: the
 * parent owns the values.
 */
export function ItemFormFields({
  value,
  onChange,
  categories,
  allTags,
  idPrefix = "item",
  duplicates = [],
}: {
  value: ItemFormPayload;
  onChange: (update: (form: ItemFormPayload) => ItemFormPayload) => void;
  categories: string[];
  allTags: string[];
  /** Keeps label/input ids unique when several forms are mounted. */
  idPrefix?: string;
  /** Possible duplicates already known, e.g. from batch add's analysis. */
  duplicates?: PossibleDuplicate[];
}) {
  const { analyzing, analyzeMsg, possibleDuplicates, analyze } = useUrlAnalyzer((data) =>
    onChange((f) => ({
      ...f,
      name: data.name || f.name,
      note: data.note || f.note,
      category: data.category || f.category,
      tags: data.tags?.length ? data.tags : f.tags,
      icon: data.icon || f.icon,
      image: data.image || f.image,
    })),
  );
  const set = (patch: Partial<ItemFormPayload>) => onChange((f) => ({ ...f, ...patch }));
  const id = (field: string) => `${idPrefix}-${field}`;
  const canAnalyze = /^https?:\/\/.+/.test(value.url.trim());

  return (
    <>
      <Field>
        <FieldLabel htmlFor={id("url")}>{m.field_url()}</FieldLabel>
        <div className="flex w-full gap-2">
          <Input
            id={id("url")}
            size="lg"
            placeholder={m.form_url_placeholder()}
            value={value.url}
            onChange={(e) => set({ url: e.target.value })}
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={!canAnalyze || analyzing}
            loading={analyzing}
            onClick={() => analyze(value.url.trim())}
            className="shrink-0"
          >
            <SparklesIcon />
            {m.form_analyze()}
          </Button>
        </div>
        {analyzeMsg && <p className="text-destructive-foreground text-xs">{analyzeMsg}</p>}
        <PossibleDuplicates items={possibleDuplicates.length ? possibleDuplicates : duplicates} />
      </Field>
      <Field>
        <FieldLabel htmlFor={id("name")}>{m.field_name_required()}</FieldLabel>
        <Input
          id={id("name")}
          size="lg"
          placeholder={m.form_name_placeholder()}
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={id("note")}>{m.field_note()}</FieldLabel>
        <Textarea
          id={id("note")}
          size="lg"
          placeholder={m.form_note_placeholder()}
          value={value.note}
          onChange={(e) => set({ note: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={id("category")}>{m.field_category()}</FieldLabel>
        <Combobox
          items={categories}
          onValueChange={(v) => set({ category: (v as string) ?? "" })}
          onInputValueChange={(v) => set({ category: v })}
        >
          <ComboboxInput
            id={id("category")}
            size="lg"
            value={value.category}
            placeholder={m.form_category_placeholder()}
          />
          <ComboboxPopup>
            <ComboboxEmpty>{m.form_category_new()}</ComboboxEmpty>
            <ComboboxList>
              {categories.map((c) => (
                <ComboboxItem key={c} value={c}>
                  {c}
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxPopup>
        </Combobox>
      </Field>
      <Field>
        <FieldLabel htmlFor={id("tags")}>{m.field_tags()}</FieldLabel>
        <TagsField tags={value.tags} onChange={(tags) => set({ tags })} suggestions={allTags} />
      </Field>
    </>
  );
}
