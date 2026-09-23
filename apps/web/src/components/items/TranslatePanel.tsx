import { LanguagesIcon, XIcon } from "lucide-react";
import type { Item } from "@pickit/shared";
import { Button } from "#components/ui/button";
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "#components/ui/menu";
import { useTranslation } from "#hooks/useTranslation";
import { m, getLocale, locales, LOCALE_NAMES } from "#lib/i18n";

/**
 * "Translate" for a bookmark's note and AI summary: pick a language, review
 * the result, then save it (replacing the originals) or dismiss it.
 */
export function TranslatePanel({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const { translation, translating, saving, translate, save, dismiss } = useTranslation(item, onChanged);
  if (!item.note && !item.aiSummary) return null;
  // The interface language first: that's usually what you want to read in.
  const targets = [getLocale(), ...locales.filter((l) => l !== getLocale())];

  return (
    <section className="space-y-2">
      <Menu>
        <MenuTrigger render={<Button variant="ghost" size="sm" loading={translating} />}>
          <LanguagesIcon />
          {m.translate_button()}
        </MenuTrigger>
        <MenuPopup align="start">
          {targets.map((locale) => (
            <MenuItem key={locale} onClick={() => translate(locale)}>
              <span lang={locale}>{m.translate_into({ language: LOCALE_NAMES[locale] })}</span>
            </MenuItem>
          ))}
        </MenuPopup>
      </Menu>
      {translation && (
        <div className="animate-fade-in space-y-2 rounded-lg border bg-muted/40 p-3 text-sm" lang={translation.locale}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-xs text-muted-foreground">
              {m.translate_result({ language: LOCALE_NAMES[translation.locale] })}
            </span>
            <Button variant="ghost" size="icon-xs" aria-label={m.chat_collapse()} onClick={dismiss}>
              <XIcon />
            </Button>
          </div>
          {translation.note && <p className="whitespace-pre-line leading-relaxed">{translation.note}</p>}
          {translation.summary && (
            <p className="text-muted-foreground leading-relaxed">{translation.summary}</p>
          )}
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={save} loading={saving}>
              {m.translate_save()}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
