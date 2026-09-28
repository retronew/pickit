// How much the chat model thinks before answering.

import { REASONING_LEVELS, type ReasoningLevel } from "@pickit/shared";
import { Field, FieldLabel, FieldDescription } from "#components/ui/field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "#components/ui/select";
import { m } from "#lib/i18n";

export const REASONING_LABELS: Record<ReasoningLevel, () => string> = {
  "provider-default": m.ai_reasoning_provider_default,
  none: m.ai_reasoning_none,
  low: m.ai_reasoning_low,
  medium: m.ai_reasoning_medium,
  high: m.ai_reasoning_high,
};

export function ReasoningField({
  value,
  onChange,
}: {
  value: ReasoningLevel;
  onChange: (value: ReasoningLevel) => void;
}) {
  const items = Object.fromEntries(REASONING_LEVELS.map((level) => [level, REASONING_LABELS[level]()]));
  return (
    <Field>
      <FieldLabel>{m.ai_reasoning()}</FieldLabel>
      <Select value={value} onValueChange={(v) => v && onChange(v as ReasoningLevel)} items={items}>
        <SelectTrigger size="lg" className="sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REASONING_LEVELS.map((level) => (
            <SelectItem key={level} value={level}>
              {REASONING_LABELS[level]()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>{m.ai_reasoning_hint()}</FieldDescription>
    </Field>
  );
}
