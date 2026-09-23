// Translations shared by the web app and the API (compiled by Paraglide
// from messages/*.json into src/paraglide on install; see `pnpm i18n`).

import { locales, baseLocale, type Locale } from "./paraglide/runtime.js";
import { m } from "./paraglide/messages.js";

export { m };
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

/**
 * A message to render later, possibly in another language: its key and
 * parameters, where a parameter can itself be a message. Used for audit
 * summaries, which are stored once and shown in whatever language is active.
 */
export interface MessageRef {
  key: string;
  params?: Record<string, string | number | MessageRef>;
}

type MessageFn = (inputs: Record<string, unknown>, options?: { locale?: Locale }) => string;
const catalog = m as unknown as Record<string, MessageFn | undefined>;

export function hasMessage(key: string): boolean {
  return typeof catalog[key] === "function";
}

/** Renders a MessageRef; an unknown key renders as the key itself. */
export function renderMessage(ref: MessageRef, locale?: Locale): string {
  const fn = catalog[ref.key];
  if (!fn) return ref.key;
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(ref.params ?? {})) {
    params[name] = typeof value === "object" ? renderMessage(value, locale) : value;
  }
  return fn(params, { locale });
}

export function isMessageRef(value: unknown): value is MessageRef {
  return !!value && typeof value === "object" && typeof (value as MessageRef).key === "string";
}
