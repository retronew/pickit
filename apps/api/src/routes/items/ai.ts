// AI-backed routes: analyze, related, summarize, re-embed.

import { Hono } from "hono";
import { isEmbeddingConfigured } from "@pickit/shared";
import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { nearest, asFloat32 } from "#vectors";
import { createProvider } from "#ai";
import { getSettings } from "#settings";
import { itemsByIds, toItemJson, findSimilarItems, embedItem } from "./helpers";

export const aiRoutes = new Hono<{ Bindings: Env }>();

aiRoutes.post("/analyze", async (c) => {
  const { url } = await c.req.json<{ url?: string }>();
  if (!url || !/^https?:\/\//.test(url)) {
    return c.json({ error: "valid url required" }, 400);
  }
  const settings = await getSettings(c.env.DB);
  const provider = settings ? createProvider(settings) : null;
  if (!provider?.chat) {
    return c.json({ error: "还没有配置对话模型，请先到「设置」里完成配置" }, 400);
  }

  let pageTitle = "";
  let description = "";
  let icon = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PickIt/1.0)" },
      redirect: "follow",
    });
    const html = (await res.text()).slice(0, 300_000);
    pageTitle = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
    description =
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      )?.[1]?.trim() ??
      html.match(
        /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
      )?.[1]?.trim() ??
      "";
    const faviconHref = html.match(
      /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i,
    )?.[1];
    const origin = new URL(res.url || url).origin;
    icon = faviconHref
      ? new URL(faviconHref, origin).toString()
      : origin + "/favicon.ico";
  } catch {
    icon = new URL(url).origin + "/favicon.ico";
  }

  const { results: catRows } = await c.env.DB.prepare(
    "SELECT DISTINCT category FROM items WHERE category != '' AND deleted_at IS NULL",
  ).all<{ category: string }>();

  const { generateText } = await import("ai");
  const { text } = await generateText({
    model: provider.chat,
    system:
      "你是技术收藏库的整理助手。根据网页信息输出 JSON（不要输出其他内容）：" +
      '{"name":"简短名称(中文或原名)","note":"一句话介绍(中文)","category":"分类名(简短中文,从已有分类中选择；都不合适才新建)","tags":["标签1","标签2"]}',
    prompt:
      `已有分类：${catRows.map((r) => r.category).join("、") || "（暂无）"}\n` +
      `URL：${url}\n网页标题：${pageTitle || "（未获取到）"}\n网页描述：${description || "（未获取到）"}`,
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
  const category = analyzed.category || "未分类";

  const possibleDuplicates = provider.embedding
    ? await findSimilarItems(c.env.DB, provider, { name, note, category })
    : [];

  return c.json({
    name,
    note,
    category,
    tags: Array.isArray(analyzed.tags) ? analyzed.tags.slice(0, 5) : [],
    icon,
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
    return c.json({ error: "还没有配置对话模型，请先到「设置」里完成配置" }, 400);
  }
  const { generateText } = await import("ai");
  const { text } = await generateText({
    model: provider.chat,
    system:
      "你是技术收藏库助手。用 2-3 句中文简明总结这个收藏条目的用途、亮点或适用场景，不要输出多余内容。",
    prompt: `名称：${row.name}\nURL：${row.url}\n备注：${row.note}\n分类：${row.category}`,
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
    return c.json({ error: "还没有配置向量模型，请先到「设置」里完成配置" }, 400);
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
