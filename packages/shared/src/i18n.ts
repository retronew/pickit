// Translations shared by the web app and the API (compiled by Paraglide
// from messages/*.json into src/paraglide on install; see `pnpm i18n`).

import { locales, baseLocale, type Locale } from "./paraglide/runtime.js";

export { m } from "./paraglide/messages.js";
export {
  getLocale,
  setLocale,
  overwriteGetLocale,
  locales,
  baseLocale,
  type Locale,
} from "./paraglide/runtime.js";

/** Each language in its own script, for the language switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  zh: "中文",
  en: "English",
  ja: "日本語",
};

/** BCP 47 tags for Intl (dates, numbers). */
export const INTL_LOCALE: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en-US",
  ja: "ja-JP",
};

/** How AI prompts name the output language. */
export const AI_LANGUAGE: Record<Locale, string> = {
  zh: "简体中文",
  en: "English",
  ja: "日本語",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Best supported locale for a tag like "en-GB" or "zh-TW"; the base locale otherwise. */
export function matchLocale(tag: string | null | undefined): Locale {
  const lang = (tag ?? "").toLowerCase().split(/[-_]/)[0];
  return isLocale(lang) ? lang : baseLocale;
}
