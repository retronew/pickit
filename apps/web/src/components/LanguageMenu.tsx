import { CheckIcon, LanguagesIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "#components/ui/menu";
import { m, getLocale, locales, LOCALE_NAMES, changeLocale } from "#lib/i18n";

/** Header menu for the interface language; the page reloads in the new language. */
export function LanguageMenu() {
  const current = getLocale();
  return (
    <Menu>
      <MenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={m.language_menu()} title={m.language_menu()} />}
      >
        <LanguagesIcon />
      </MenuTrigger>
      <MenuPopup align="end">
        {locales.map((locale) => (
          <MenuItem key={locale} onClick={() => locale !== current && changeLocale(locale)}>
            <CheckIcon className={locale === current ? "" : "invisible"} />
            <span lang={locale}>{LOCALE_NAMES[locale]}</span>
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}
