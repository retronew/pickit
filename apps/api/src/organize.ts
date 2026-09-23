import type { LanguageModel } from "ai";
import type { ItemRow } from "#types";

// AI category / tag suggestions, shared by the batch organize job (applies
// them directly) and the review flow on the items page (user picks).

export interface Suggestion {
  category: string;
  tags: string[];
}

const MAX_TAGS = 5;

const SYSTEM =
  "你是技术收藏库的整理助手。根据条目信息输出 JSON（不要输出其他内容）：" +
  '{"category":"分类名(简短中文,优先从已有分类中选择；都不合适才新建)","tags":["标签1","标签2"]}';

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
  if (start < 0 || end < start) throw new Error(`模型没有返回 JSON：${text.slice(0, 100)}`);
  const parsed = JSON.parse(text.slice(start, end + 1)) as { category?: unknown; tags?: unknown };
  const category =
    typeof parsed.category === "string" && parsed.category.trim() ? parsed.category.trim() : current.category;
  const tags = Array.isArray(parsed.tags)
    ? [...new Set(parsed.tags.filter((t): t is string => typeof t === "string" && !!t.trim()).map((t) => t.trim()))]
    : current.tags;
  return { category, tags: tags.slice(0, MAX_TAGS) };
}

export async function suggestOrganize(
  chat: LanguageModel,
  row: ItemRow,
  categories: string[],
): Promise<Suggestion> {
  const { generateText } = await import("ai");
  const { text } = await generateText({
    model: chat,
    maxRetries: 1,
    system: SYSTEM,
    prompt:
      `已有分类：${categories.join("、") || "（暂无）"}\n` +
      `名称：${row.name}\nURL：${row.url}\n备注：${row.note}\n` +
      `当前分类：${row.category || "（无）"}\n当前标签：${row.tags}`,
  });
  return parseSuggestion(text, { category: row.category, tags: JSON.parse(row.tags || "[]") });
}
