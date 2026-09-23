import { useEffect, useState } from "react";
import type { Item } from "@pickit/shared";
import { api, toastError, toastSuccess } from "#lib/api";
import { m, type Locale } from "#lib/i18n";

export interface Translation {
  locale: Locale;
  note: string;
  summary: string;
}

/** AI translation of an item's note / summary: preview first, then save. */
export function useTranslation(item: Item | null, onChanged: () => void) {
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setTranslation(null), [item?.id]);

  async function translate(target: Locale) {
    if (!item) return;
    setTranslating(true);
    try {
      setTranslation(await api<Translation>(`/api/items/${item.id}/translate`, { json: { target } }));
    } catch (err) {
      toastError(m.translate_failed(), err, { id: "translate" });
    } finally {
      setTranslating(false);
    }
  }

  async function save() {
    if (!item || !translation) return;
    setSaving(true);
    try {
      await api(`/api/items/${item.id}/translate`, {
        json: {
          save: true,
          note: translation.note || undefined,
          summary: translation.summary || undefined,
        },
      });
      toastSuccess(m.translate_saved(), { id: "translate" });
      setTranslation(null);
      onChanged();
    } catch (err) {
      toastError(m.save_failed(), err, { id: "translate" });
    } finally {
      setSaving(false);
    }
  }

  return { translation, translating, saving, translate, save, dismiss: () => setTranslation(null) };
}
