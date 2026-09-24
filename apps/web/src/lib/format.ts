import { intlLocale } from "#lib/i18n";

const UNITS = ["B", "KB", "MB", "GB"];

/** 1536 → "1.5 KB". */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${UNITS[unit]}`;
}

export function formatDate(ts: number): string {
  return new Intl.DateTimeFormat(intlLocale(), { year: "numeric", month: "2-digit", day: "2-digit" }).format(ts);
}

export function formatDateTime(ts: number): string {
  return new Intl.DateTimeFormat(intlLocale(), { dateStyle: "short", timeStyle: "short" }).format(ts);
}

/** "JP" → "Japan" in the UI language; the code itself when unknown. */
export function formatCountry(code: string): string {
  try {
    return new Intl.DisplayNames([intlLocale()], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
