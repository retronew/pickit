import {
  getLocale,
  setLocale,
  isLocale,
  m,
  INTL_LOCALE,
  type Locale,
} from "@pickit/shared/i18n";

export { m, getLocale, locales, LOCALE_NAMES, type Locale } from "@pickit/shared/i18n";

/** The current language as a BCP 47 tag for Intl formatters. */
export function intlLocale(): string {
  return INTL_LOCALE[getLocale()];
}

/**
 * Marks <html lang> (screen readers, fonts) and sets the cookie the API reads
 * to answer in the same language.
 */
export function applyDocumentLocale() {
  document.documentElement.lang = intlLocale();
  document.title = `PickIt — ${m.app_tagline()}`;
  document.cookie = `pickit_locale=${getLocale()}; path=/; max-age=31536000; SameSite=Lax`;
}

/** Saves the choice on the server (AI output, other devices) and reloads. */
export async function changeLocale(locale: Locale) {
  await fetch("/api/settings/locale", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  }).catch(() => {});
  setLocale(locale);
}

/**
 * After sign-in: follow the language saved on the server (chosen on another
 * device), or record the browser's language the first time.
 */
export async function syncLocaleWithServer() {
  try {
    const res = await fetch("/api/settings/locale");
    if (!res.ok) return;
    const { locale } = (await res.json()) as { locale: string | null };
    if (isLocale(locale)) {
      if (locale !== getLocale()) setLocale(locale);
    } else {
      await fetch("/api/settings/locale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: getLocale() }),
      });
    }
  } catch {
    // Offline or signed out: keep the local choice.
  }
}
