import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { locales, matchLocale } from "./i18n";

// Paraglide silently falls back when a translation is missing, so this test
// is what keeps the three languages complete and consistent.

const dir = join(dirname(fileURLToPath(import.meta.url)), "../messages");
const load = (locale: string): Record<string, string> => {
  const { $schema: _schema, ...messages } = JSON.parse(readFileSync(join(dir, `${locale}.json`), "utf8"));
  return messages;
};
const catalogs = Object.fromEntries(locales.map((l) => [l, load(l)]));
const base = catalogs.zh;

/** Placeholder names, e.g. {count} and {name}; plural / select bodies ignored. */
function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\s*([a-zA-Z_]\w*)\s*[,}]/g)].map((m) => m[1]))].sort();
}

describe("translations", () => {
  it.each(locales.filter((l) => l !== "zh"))("%s has exactly the keys of zh", (locale) => {
    const keys = Object.keys(catalogs[locale]);
    expect(keys.filter((k) => !(k in base)), "extra keys").toEqual([]);
    expect(Object.keys(base).filter((k) => !keys.includes(k)), "missing keys").toEqual([]);
  });

  it.each(locales)("%s has no empty messages", (locale) => {
    const empty = Object.entries(catalogs[locale]).filter(([, v]) => !String(v).trim());
    expect(empty.map(([k]) => k)).toEqual([]);
  });

  it.each(locales.filter((l) => l !== "zh"))("%s uses the same placeholders as zh", (locale) => {
    const mismatched = Object.keys(base).filter(
      (k) => k in catalogs[locale] && placeholders(base[k]).join() !== placeholders(catalogs[locale][k]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it.each(locales)("%s avoids ICU plural / select syntax, which Paraglide's format doesn't support", (locale) => {
    // It compiles, then renders garbage like "undefined other }".
    const icu = Object.entries(catalogs[locale]).filter(([, v]) => /\{\s*\w+\s*,\s*(plural|select|selectordinal)\s*,/.test(v));
    expect(icu.map(([k]) => k)).toEqual([]);
  });

  it("uses snake_case keys", () => {
    expect(Object.keys(base).filter((k) => !/^[a-z][a-z0-9_]*$/.test(k))).toEqual([]);
  });
});

describe("matchLocale", () => {
  it("maps browser tags to supported locales", () => {
    expect(matchLocale("en-GB")).toBe("en");
    expect(matchLocale("ja")).toBe("ja");
    expect(matchLocale("zh-TW")).toBe("zh");
    expect(matchLocale("fr-FR")).toBe("zh");
    expect(matchLocale(undefined)).toBe("zh");
  });
});
