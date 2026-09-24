// AI-backed routes: analyze, related, summarize, translate, re-embed.

import { Hono } from "hono";
import { fetchPageMeta } from "#page-meta";
import { isEmbeddingConfigured } from "@pickit/shared";
import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { nearest, asFloat32 } from "#vectors";
import { createProvider } from "#ai";
import { getSettings } from "#settings";
import { itemsByIds, toItemJson, findSimilarItems, embedItem } from "./helpers";
import { tr } from "#i18n";
import { aiLocale } from "#locale";
import { analyzePrompt, parseJsonReply, summarizePrompt, translatePrompt } from "#prompts";
import { isLocale } from "@pickit/shared/i18n";

export const aiRoutes = new Hono<{ Bindings: Env }>();

aiRoutes.post("/analyze", async (c) => {
  const { url } = await c.req.json<{ url?: string }>();
  if (!url || !/^https?:\/\//.test(url)) {
    return c.json({ error: "valid url required" }, 400);
  }
  const settings = await getSettings(c.env.DB);
  const provider = settings ? createProvider(settings) : null;
  if (!provider?.chat) {
    return c.json({ error: await tr(c, "api_need_chat") }, 400);
  }

  const { title: pageTitle, description, icon, image } = await fetchPageMeta(url);

  const { results: catRows } = await c.env.DB.prepare(
    "SELECT DISTINCT category FROM items WHERE category != '' AND deleted_at IS NULL",
  ).all<{ category: string }>();

  const { generateText } = await import("ai");
  const { text } = await generateText({
    model: provider.chat,
    ...analyzePrompt(await aiLocale(c.env.DB), {
      categories: catRows.map((r) => r.category),
      url,
      title: pageTitle,
      description,
    }),
  });

  let analyzed: {
    name?: string;
    note?: string;
    category?: string;
    tags?: string[];
  } = {};
  try {
    const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    analyzed = JSON.parse(jsonStr);
  } catch {
    // AI output unparseable, fall back to page title
  }

  const name = analyzed.name || pageTitle || new URL(url).hostname;
  const note = analyzed.note || description;
  const category = analyzed.category || "";

  const possibleDuplicates = provider.embedding
    ? await findSimilarItems(c.env.DB, provider, { name, note, category })
    : [];

  return c.json({
    name,
    note,
    category,
    tags: Array.isArray(analyzed.tags) ? analyzed.tags.slice(0, 5) : [],
    icon,
    image,
    possibleDuplicates,
  });
});

aiRoutes.get("/:id/related", async (c) => {
  const id = Number(c.req.param("id"));
  const limit = Math.min(Number(c.req.query("limit")) || 6, 20);
  const row = await c.env.DB.prepare(
    `SELECT ${ITEM_COLUMNS}, embedding FROM items WHERE id = ?`,
  )
    .bind(id)
    .first<ItemRow>();
  if (!row) return c.json({ error: "not found" }, 404);

  if (row.embedding && row.embedding_model) {
    const top = await nearest(c.env.DB, asFloat32(row.embedding), row.embedding_model, {
      limit,
      excludeId: id,
    });
    const rows = await itemsByIds(c.env.DB, top.map((t) => t.id));
    const related = top.flatMap((t) => (rows.has(t.id) ? [toItemJson(rows.get(t.id)!)] : []));
    if (related.length > 0) return c.json(related);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM items WHERE id != ? AND category = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(id, row.category, limit)
    .all<ItemRow>();
  return c.json(results.map(toItemJson));
});

aiRoutes.post("/:id/summarize", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await c.env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = ?`)
    .bind(id)
    .first<ItemRow>();
  if (!row) return c.json({ error: "not found" }, 404);
  const settings = await getSettings(c.env.DB);
  const provider = settings ? createProvider(settings) : null;
  if (!provider?.chat) {
    return c.json({ error: await tr(c, "api_need_chat") }, 400);
  }
  const { generateText } = await import("ai");
  const { text } = await generateText({
    model: provider.chat,
    ...summarizePrompt(await aiLocale(c.env.DB), row),
  });
  const summary = text.trim();
  await c.env.DB.prepare("UPDATE items SET ai_summary=? WHERE id=?")
    .bind(summary, id)
    .run();
  return c.json({ summary });
});

aiRoutes.post("/:id/reembed", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await c.env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = ?`)
    .bind(id)
    .first<ItemRow>();
  if (!row) return c.json({ error: "not found" }, 404);
  const settings = await getSettings(c.env.DB);
  if (!settings || !isEmbeddingConfigured(settings)) {
    return c.json({ error: await tr(c, "api_need_embedding") }, 400);
  }
  c.executionCtx.waitUntil(
    embedItem(
      c.env,
      id,
      {
        name: row.name,
        url: row.url,
        note: row.note,
        category: row.category,
      },
      settings,
    ).catch(() => {}),
  );
  return c.json({ ok: true });
});

// Registered last among GET routes: Hono matches route patterns in
// registration order, and this catch-all-looking single segment would
// otherwise shadow every other static GET route above it.

interface TranslateBody {
  target?: unknown;
  /** Store the given (reviewed) texts instead of translating. */
  save?: boolean;
  note?: unknown;
  summary?: unknown;
}

/**
 * Translates an item's note and AI summary into `target` (default: the AI
 * output language) without saving; `save: true` stores reviewed texts.
 */
aiRoutes.post("/:id/translate", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await c.env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<ItemRow>();
  if (!row) return c.json({ error: await tr(c, "api_item_not_found") }, 404);
  const body = await c.req.json<TranslateBody>().catch(() => ({}) as TranslateBody);

  if (body.save) {
    const note = typeof body.note === "string" ? body.note : null;
    const summary = typeof body.summary === "string" ? body.summary : null;
    await c.env.DB.prepare(
      "UPDATE items SET note = COALESCE(?, note), ai_summary = COALESCE(?, ai_summary), updated_at = ? WHERE id = ?",
    )
      .bind(note, summary, Date.now(), id)
      .run();
    const settings = await getSettings(c.env.DB);
    if (note !== null && settings) {
      c.executionCtx.waitUntil(embedItem(c.env, id, { ...row, note }, settings).catch(() => {}));
    }
    return c.json({ saved: true });
  }

  const texts: Record<string, string> = {};
  if (row.note.trim()) texts.note = row.note;
  if (row.ai_summary?.trim()) texts.summary = row.ai_summary;
  if (Object.keys(texts).length === 0) return c.json({ error: await tr(c, "api_translate_empty") }, 400);

  const settings = await getSettings(c.env.DB);
  const provider = settings ? createProvider(settings) : null;
  if (!provider?.chat) return c.json({ error: await tr(c, "api_need_chat") }, 400);

  const locale = isLocale(body.target) ? body.target : await aiLocale(c.env.DB);
  const { generateText } = await import("ai");
  const { text } = await generateText({ model: provider.chat, maxRetries: 1, ...translatePrompt(locale, texts) });
  let translated: Record<string, unknown>;
  try {
    translated = parseJsonReply(text);
  } catch {
    return c.json({ error: await tr(c, "api_ai_no_json", { reply: text.slice(0, 100) }) }, 502);
  }
  const pick = (key: string) => (typeof translated[key] === "string" && key in texts ? (translated[key] as string) : "");
  return c.json({ locale, note: pick("note"), summary: pick("summary") });
});
