import type { LanguageModel } from "ai";
import type { ItemRow } from "#types";
import { LocalizedError, type Locale } from "#i18n";
import { organizePrompt } from "#prompts";

// AI category / tag suggestions, shared by the batch organize job (applies
// them directly) and the review flow on the items page (user picks).

export interface Suggestion {
  category: string;
  tags: string[];
}

const MAX_TAGS = 5;

export async function activeCategories(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT DISTINCT category FROM items WHERE category != '' AND deleted_at IS NULL")
    .all<{ category: string }>();
  return results.map((r) => r.category);
}

/**
 * Reads the model's JSON reply (possibly wrapped in prose or a code fence).
 * Missing fields fall back to the item's current values.
 */
export function parseSuggestion(text: string, current: Suggestion): Suggestion {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new LocalizedError({ key: "api_ai_no_json", params: { reply: text.slice(0, 100) } });
  }
  const parsed = JSON.parse(text.slice(start, end + 1)) as { category?: unknown; tags?: unknown };
  const category =
    typeof parsed.category === "string" && parsed.category.trim() ? parsed.category.trim() : current.category;
  const tags = Array.isArray(parsed.tags)
    ? [...new Set(parsed.tags.filter((t): t is string => typeof t === "string" && !!t.trim()).map((t) => t.trim()))]
    : current.tags;
  return { category, tags: tags.slice(0, MAX_TAGS) };
}

/** `locale` is the language new categories and tags are written in. */
export async function suggestOrganize(
  chat: LanguageModel,
  row: ItemRow,
  categories: string[],
  locale: Locale,
): Promise<Suggestion> {
  const { generateText } = await import("ai");
  const { text } = await generateText({
    model: chat,
    maxRetries: 1,
    ...organizePrompt(locale, {
      categories,
      name: row.name,
      url: row.url,
      note: row.note,
      category: row.category,
      tags: row.tags,
    }),
  });
  return parseSuggestion(text, { category: row.category, tags: JSON.parse(row.tags || "[]") });
}
