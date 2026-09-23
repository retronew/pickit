import { baseLocale, isLocale, type Locale } from "@pickit/shared/i18n";

// The owner's language: the interface language (null until chosen, then the
// web app follows the browser) and the language AI writes in ("auto" = the
// interface language). Stored server-side so cron jobs and AI calls know it.

export type AiLanguage = Locale | "auto";

export interface LocalePrefs {
  locale: Locale | null;
  aiLanguage: AiLanguage;
}

async function read(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

async function write(db: D1Database, key: string, value: string) {
  await db
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(key, value)
    .run();
}

export async function getLocalePrefs(db: D1Database): Promise<LocalePrefs> {
  const [locale, ai] = await Promise.all([read(db, "locale"), read(db, "ai_language")]);
  return {
    locale: isLocale(locale) ? locale : null,
    aiLanguage: isLocale(ai) ? ai : "auto",
  };
}

export function isAiLanguage(value: unknown): value is AiLanguage {
  return value === "auto" || isLocale(value);
}

export async function setLocalePrefs(db: D1Database, prefs: Partial<LocalePrefs>) {
  if (prefs.locale) await write(db, "locale", prefs.locale);
  if (prefs.aiLanguage) await write(db, "ai_language", prefs.aiLanguage);
}

/** The interface language, falling back to the base locale. */
export async function uiLocale(db: D1Database): Promise<Locale> {
  return (await getLocalePrefs(db)).locale ?? baseLocale;
}

/** The language AI output should be written in. */
export async function aiLocale(db: D1Database): Promise<Locale> {
  const prefs = await getLocalePrefs(db);
  return prefs.aiLanguage === "auto" ? (prefs.locale ?? baseLocale) : prefs.aiLanguage;
}
