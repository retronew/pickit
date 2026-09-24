import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import type { ThemeMode } from "#hooks/useTheme";
import { m } from "#lib/i18n";

export const THEME_MODES: ThemeMode[] = ["system", "light", "dark"];

export const THEME_MODE_LABEL: Record<ThemeMode, string> = {
  system: m.theme_system(),
  light: m.theme_light(),
  dark: m.theme_dark(),
};

export const THEME_MODE_ICON = { system: MonitorIcon, light: SunIcon, dark: MoonIcon } as const;
