import { useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "#components/ui/select";
import { Input } from "#components/ui/input";
import { Button } from "#components/ui/button";
import { Confirm } from "#components/Confirm";
import { m } from "#lib/i18n";

const PRESETS: Record<string, string> = {
  "30": m.retention_days({ days: 30 }),
  "90": m.retention_days({ days: 90 }),
  "180": m.retention_days({ days: 180 }),
  "365": m.retention_years({ years: 1 }),
  "730": m.retention_years({ years: 2 }),
  "0": m.retention_forever(),
  custom: m.retention_custom(),
};

export const retentionLabel = (days: number) => (days === 0 ? m.retention_forever() : m.retention_days({ days }));

interface Props {
  /** Days kept; 0 = forever. */
  value: number;
  max: number;
  /** Shown before shortening the period, since older records go right away. */
  confirmMessage: (days: number) => string;
  onSave: (days: number) => Promise<unknown>;
}

/** "Keep for" picker: presets, forever or a custom number of days. */
export function RetentionSelect({ value, max, confirmMessage, onSave }: Props) {
  const [custom, setCustom] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(days: number) {
    if (days === value) return;
    const shorter = days !== 0 && (value === 0 || days < value);
    if (shorter) {
      const ok = await Confirm.call({
        title: m.retention_confirm_title({ days }),
        message: confirmMessage(days),
        confirmLabel: m.retention_confirm(),
        danger: true,
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await onSave(days);
      setCustom(null);
    } catch {
      // onSave reports its own error.
    } finally {
      setSaving(false);
    }
  }

  const current = String(value);
  const selectValue = custom !== null ? "custom" : current in PRESETS ? current : "custom";
  const items = current in PRESETS ? PRESETS : { ...PRESETS, custom: m.retention_days({ days: value }) };

  return (
    <span className="ml-auto flex shrink-0 items-center gap-2">
      <span className="text-muted-foreground max-sm:sr-only">{m.retention_label()}</span>
      <Select
        value={selectValue}
        items={items}
        disabled={saving}
        onValueChange={(v) => {
          if (v === "custom") setCustom(current === "0" ? "" : current);
          else if (v != null) save(Number(v));
        }}
      >
        <SelectTrigger size="sm" className="w-auto min-w-28 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {Object.entries(items).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      {custom !== null && (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const days = Number(custom);
            if (Number.isInteger(days) && days >= 1 && days <= max) save(days);
          }}
        >
          <Input
            size="sm"
            type="number"
            min={1}
            max={max}
            className="w-20"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label={m.retention_days_label()}
            autoFocus
          />
          <span className="text-muted-foreground">{m.retention_day_unit()}</span>
          <Button size="sm" type="submit" disabled={saving || !custom}>
            {m.common_save()}
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setCustom(null)}>
            {m.common_cancel()}
          </Button>
        </form>
      )}
    </span>
  );
}
