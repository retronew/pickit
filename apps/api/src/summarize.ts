import type { LanguageModel } from "ai";
import type { ItemRow } from "#types";
import type { Locale } from "#i18n";
import { summarizePrompt } from "#prompts";

// AI summaries, shared by the per-item button and the batch summarize job.

/** Generates a summary of `row` and stores it. Returns the summary. */
export async function summarizeItem(
  db: D1Database,
  chat: LanguageModel,
  row: Pick<ItemRow, "id" | "name" | "url" | "note" | "category">,
  locale: Locale,
): Promise<string> {
  const { generateText } = await import("ai");
  const { text } = await generateText({ model: chat, ...summarizePrompt(locale, row) });
  const summary = text.trim();
  await db.prepare("UPDATE items SET ai_summary=? WHERE id=?").bind(summary, row.id).run();
  return summary;
}
