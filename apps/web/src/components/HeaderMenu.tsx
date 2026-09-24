import { EllipsisVerticalIcon, LanguagesIcon, LogOutIcon } from "lucide-react";
import type { ThemeMode } from "#hooks/useTheme";
import { Button } from "#components/ui/button";
import {
  Menu,
  MenuTrigger,
  MenuPopup,
  MenuItem,
  MenuGroup,
  MenuGroupLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubTrigger,
  MenuSubPopup,
} from "#components/ui/menu";
import { THEME_MODES, THEME_MODE_ICON, THEME_MODE_LABEL } from "#lib/theme-labels";
import { m, getLocale, locales, LOCALE_NAMES, changeLocale, type Locale } from "#lib/i18n";

/** Phone header: theme, language and sign-out folded into one menu. */
export function HeaderMenu({
  mode,
  onModeChange,
  onSignOut,
}: {
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
  onSignOut: () => void;
}) {
  const locale = getLocale();
  return (
    <Menu>
      <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={m.nav_more()} />}>
        <EllipsisVerticalIcon />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-44">
        <MenuGroup>
          <MenuGroupLabel>{m.theme_label()}</MenuGroupLabel>
          <MenuRadioGroup value={mode} onValueChange={(v) => onModeChange(v as ThemeMode)}>
            {THEME_MODES.map((value) => {
              const Icon = THEME_MODE_ICON[value];
              return (
                <MenuRadioItem key={value} value={value}>
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 opacity-72" />
                    {THEME_MODE_LABEL[value]}
                  </span>
                </MenuRadioItem>
              );
            })}
          </MenuRadioGroup>
        </MenuGroup>
        <MenuSeparator />
        <MenuSub>
          <MenuSubTrigger>
            <LanguagesIcon />
            {m.language_menu()}
            <span className="ms-auto text-muted-foreground text-xs">{LOCALE_NAMES[locale]}</span>
          </MenuSubTrigger>
          <MenuSubPopup>
            <MenuRadioGroup
              value={locale}
              onValueChange={(v) => v !== locale && changeLocale(v as Locale)}
            >
              {locales.map((value) => (
                <MenuRadioItem key={value} value={value}>
                  <span lang={value}>{LOCALE_NAMES[value]}</span>
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuSubPopup>
        </MenuSub>
        <MenuSeparator />
        <MenuItem onClick={onSignOut}>
          <LogOutIcon />
          {m.nav_sign_out()}
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
