// Helpers for drafting translations with AI (scripts/translate-messages.ts).
// Pure functions, no imports, so the script can run them with plain Node.

export type Catalog = Record<string, string>;

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ja: "Japanese",
  zh: "Simplified Chinese",
};

/** Keys present in the base catalog but missing (or empty) in `target`. */
export function missingKeys(base: Catalog, target: Catalog): string[] {
  return Object.keys(base).filter((k) => k !== "$schema" && !target[k]?.trim());
}

/** Placeholder names like {count}, sorted. */
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\s*([a-zA-Z_]\w*)\s*\}/g)].map((m) => m[1]))].sort();
}

/**
 * Why a draft translation can't be used, or null when it can: it must be a
 * non-empty string with exactly the source's placeholders.
 */
export function rejectDraft(source: string, draft: unknown): string | null {
  if (typeof draft !== "string" || !draft.trim()) return "empty";
  const want = placeholders(source).join(",");
  const got = placeholders(draft).join(",");
  return want === got ? null : `placeholders {${got}} ≠ {${want}}`;
}

/** Splits keys into batches so each request stays small. */
export function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function translationPrompt(language: string) {
  return (
    `You translate UI strings of PickIt, a personal bookmark manager, from Simplified Chinese into ${language}. ` +
    "Reply with a JSON object with exactly the same keys. Keep every {placeholder} unchanged, keep product " +
    "names (PickIt, Google, GitHub, MCP, API, RSS, R2, Markdown…) and technical terms as they are. Use concise, " +
    "natural UI wording (buttons short, sentences complete). Do not use ICU plural syntax; phrase counts so they " +
    "read correctly for any number."
  );
}

/** The catalog with `drafts` added, keys sorted, $schema first. */
export function mergeCatalog(target: Catalog, drafts: Catalog): Catalog {
  const { $schema, ...rest } = { ...target, ...drafts };
  return { ...($schema ? { $schema } : {}), ...Object.fromEntries(Object.entries(rest).sort(([a], [b]) => a.localeCompare(b))) };
}
