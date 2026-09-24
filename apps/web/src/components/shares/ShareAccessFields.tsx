import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "#components/ui/select";
import { Field, FieldLabel } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { Switch } from "#components/ui/switch";
import { EXPIRY_LABELS, EXPIRY_PRESETS, type ExpiryPreset } from "#lib/shares";
import { m } from "#lib/i18n";

/** "keep" leaves an existing expiry unchanged (edit dialog only). */
export type ExpiryChoice = ExpiryPreset | "keep";

interface Props {
  expiry: ExpiryChoice;
  onExpiryChange: (expiry: ExpiryChoice) => void;
  /** Label of the "keep current expiry" option; omitted = no such option. */
  keepLabel?: string;
  protect: boolean;
  onProtectChange: (protect: boolean) => void;
  password: string;
  onPasswordChange: (password: string) => void;
  /** The share already has a password: an empty field keeps it. */
  hasPassword?: boolean;
}

/** Expiry and password controls for a share link. */
export function ShareAccessFields({
  expiry,
  onExpiryChange,
  keepLabel,
  protect,
  onProtectChange,
  password,
  onPasswordChange,
  hasPassword,
}: Props) {
  const items: Record<string, string> = {
    ...(keepLabel ? { keep: keepLabel } : {}),
    ...Object.fromEntries(EXPIRY_PRESETS.map((p) => [p, EXPIRY_LABELS[p]()])),
  };

  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel>{m.share_expiry_label()}</FieldLabel>
        <Select value={expiry} items={items} onValueChange={(v) => v && onExpiryChange(v as ExpiryChoice)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {Object.entries(items).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </Field>
      <Field>
        <div className="flex w-full items-center justify-between gap-3">
          <FieldLabel htmlFor="share-protect">{m.share_password_label()}</FieldLabel>
          <Switch id="share-protect" checked={protect} onCheckedChange={onProtectChange} />
        </div>
        {protect && (
          <Input
            type="password"
            autoComplete="new-password"
            maxLength={100}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={hasPassword ? m.share_password_keep() : m.share_password_placeholder()}
            aria-label={m.share_password_label()}
          />
        )}
      </Field>
    </div>
  );
}
