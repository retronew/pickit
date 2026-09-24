import { Field, FieldLabel } from "#components/ui/field";
import { MultiSelectField } from "#components/MultiSelectField";
import { useShareTargets } from "#hooks/useShareTargets";
import { m } from "#lib/i18n";

interface Props {
  categories: string[];
  tags: string[];
  onCategoriesChange: (categories: string[]) => void;
  onTagsChange: (tags: string[]) => void;
}

/** Picks categories and tags to share; items matching any of them are listed. */
export function ShareTargetPicker({ categories, tags, onCategoriesChange, onTagsChange }: Props) {
  const options = useShareTargets(true);

  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel htmlFor="share-categories">{m.share_pick_category()}</FieldLabel>
        <MultiSelectField
          id="share-categories"
          options={options.categories ?? []}
          value={categories}
          onChange={onCategoriesChange}
          placeholder={m.share_pick_placeholder()}
          empty={m.share_pick_none()}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="share-tags">{m.share_pick_tag()}</FieldLabel>
        <MultiSelectField
          id="share-tags"
          options={options.tags ?? []}
          value={tags}
          onChange={onTagsChange}
          placeholder={m.share_pick_placeholder()}
          empty={m.share_pick_none()}
          format={(t) => `#${t}`}
        />
      </Field>
    </div>
  );
}
