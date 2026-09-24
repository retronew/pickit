import { AI_LANGUAGE, type Locale } from "@pickit/shared/i18n";

// Every prompt sent to the chat model. Written in English (followed most
// reliably across providers) with an explicit output language, which comes
// from the "AI output language" setting (see locale.ts: aiLocale).

const lang = (locale: Locale) => AI_LANGUAGE[locale];

const none = "(none)";

/** Name / note / category / tags for a new link. Reply: JSON. */
export function analyzePrompt(
  locale: Locale,
  input: { categories: string[]; url: string; title: string; description: string },
) {
  return {
    system:
      "You organize a personal bookmark library. Reply with JSON only, no other text: " +
      '{"name": string, "note": string, "category": string, "tags": string[]}. ' +
      `name: a short name (the product's own name is fine). note: one sentence describing it, in ${lang(locale)}. ` +
      "category: reuse one of the existing categories exactly as written whenever one fits; only if none fits, " +
      `create a short new one in ${lang(locale)} (two levels like "A/B" are allowed). ` +
      `tags: 2-5 short tags; product and technical names stay as they are, other tags in ${lang(locale)}.`,
    prompt:
      `Existing categories: ${input.categories.join(", ") || none}\n` +
      `URL: ${input.url}\nPage title: ${input.title || none}\nPage description: ${input.description || none}`,
  };
}

/** Category / tags for an existing item. Reply: JSON. */
export function organizePrompt(
  locale: Locale,
  input: { categories: string[]; name: string; url: string; note: string; category: string; tags: string },
) {
  return {
    system:
      "You organize a personal bookmark library. Reply with JSON only, no other text: " +
      '{"category": string, "tags": string[]}. ' +
      "category: reuse one of the existing categories exactly as written whenever one fits; only if none fits, " +
      `create a short new one in ${lang(locale)}. ` +
      `tags: 2-5 short tags; product and technical names stay as they are, other tags in ${lang(locale)}.`,
    prompt:
      `Existing categories: ${input.categories.join(", ") || none}\n` +
      `Name: ${input.name}\nURL: ${input.url}\nNote: ${input.note || none}\n` +
      `Current category: ${input.category || none}\nCurrent tags: ${input.tags}`,
  };
}

/** A 2-3 sentence summary. Reply: plain text. */
export function summarizePrompt(
  locale: Locale,
  input: { name: string; url: string; note: string; category: string },
) {
  return {
    system:
      `You summarize bookmarks in a personal library. In ${lang(locale)}, write 2-3 concise sentences on ` +
      "what it is for, what stands out and when to use it. Output only the summary.",
    prompt: `Name: ${input.name}\nURL: ${input.url}\nNote: ${input.note || none}\nCategory: ${input.category || none}`,
  };
}

/** Recommends items from the library; cites them as [[id]]. */
export function chatSystem(locale: Locale, catalog: string) {
  return (
    "You are the assistant for the user's personal bookmark library. The user describes " +
    "a need; recommend the best matching bookmarks with a short reason for each, concise and practical. " +
    "If nothing in the library fits, say so honestly and give general advice. " +
    "Whenever you mention a bookmark, cite it as [[id]] (e.g. [[123]]) instead of writing its name or link. " +
    `Reply in ${lang(locale)}, unless the user clearly writes in another language; then reply in theirs.\n\n` +
    `The user's bookmarks (relevant ones):\n${catalog}`
  );
}

/** Translates a bookmark's texts. Reply: JSON with the same keys. */
export function translatePrompt(locale: Locale, texts: Record<string, string>) {
  return {
    system:
      `Translate the values of this JSON object into ${lang(locale)}. Keep the keys, Markdown, links, ` +
      "code, and product or technical names unchanged. If a value is already in that language, return it " +
      "as is. Reply with the JSON object only.",
    prompt: JSON.stringify(texts),
  };
}

/** Reads a JSON object out of a model reply that may add prose or a code fence. */
export function parseJsonReply<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`no JSON in model reply: ${text.slice(0, 100)}`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}
