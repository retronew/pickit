import { Hono } from "hono";
import {
  normalizeUrl,
  parseMarkdownTables,
  parseBookmarksHtml,
  parseJsonItems,
  type ImportRow,
} from "@pickit/shared";
import type { Env, ItemRow } from "#types";
import type { AiSettings } from "#ai";
import { getSettings } from "#settings";
import { isChatConfigured, isEmbeddingConfigured } from "@pickit/shared";
import { createProvider, embedText, cosSim, type Provider } from "#ai";
import { getJob, saveJob, runBatchJob, type JobState } from "#jobs";
import { checkLink } from "#cron";

export const itemRoutes = new Hono<{ Bindings: Env }>();

function toItemJson(r: ItemRow) {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    icon: r.icon,
    note: r.note,
    category: r.category,
    tags: JSON.parse(r.tags || "[]"),
    pinned: !!r.pinned,
    hasEmbedding: !!r.embedding,
    clickCount: r.click_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    aiSummary: r.ai_summary,
    httpStatus: r.http_status,
    checkedAt: r.checked_at,
  };
}

itemRoutes.get("/", async (c) => {
  const { category } = c.req.query();
  let sql = "SELECT * FROM items WHERE deleted_at IS NULL";
  const args: string[] = [];
  if (category) {
    sql += " AND category = ?";
    args.push(category);
  }
  sql += " ORDER BY pinned DESC, category, name";
  const { results } = await c.env.DB.prepare(sql).bind(...args).all<ItemRow>();
  return c.json(results.map(toItemJson));
});

itemRoutes.get("/stats", async (c) => {
  const totalRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM items WHERE deleted_at IS NULL",
  ).first<{ n: number }>();
  const { results: byCategory } = await c.env.DB.prepare(
    "SELECT category, COUNT(*) AS count FROM items WHERE deleted_at IS NULL GROUP BY category ORDER BY count DESC",
  ).all<{ category: string; count: number }>();
  const { results: byMonth } = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', created_at / 1000, 'unixepoch') AS month, COUNT(*) AS count
     FROM items WHERE deleted_at IS NULL GROUP BY month ORDER BY month`,
  ).all<{ month: string; count: number }>();
  const { results: clickTop } = await c.env.DB.prepare(
    "SELECT id, name, click_count FROM items WHERE deleted_at IS NULL AND click_count > 0 ORDER BY click_count DESC LIMIT 10",
  ).all<{ id: number; name: string; click_count: number }>();
  const embeddedRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM items WHERE deleted_at IS NULL AND embedding IS NOT NULL",
  ).first<{ n: number }>();
  const deadRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM items WHERE deleted_at IS NULL AND checked_at IS NOT NULL
     AND (http_status IS NULL OR http_status >= 400)`,
  ).first<{ n: number }>();
  const trashRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM items WHERE deleted_at IS NOT NULL",
  ).first<{ n: number }>();

  const total = totalRow?.n ?? 0;
  return c.json({
    total,
    byCategory: byCategory.map((r) => ({
      category: r.category || "未分类",
      count: r.count,
    })),
    byMonth,
    clickTop: clickTop.map((r) => ({
      id: r.id,
      name: r.name,
      clickCount: r.click_count,
    })),
    embeddingCoverage: total > 0 ? (embeddedRow?.n ?? 0) / total : 0,
    deadLinks: deadRow?.n ?? 0,
    trash: trashRow?.n ?? 0,
  });
});

itemRoutes.get("/trash", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM items WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
  ).all<ItemRow>();
  return c.json(results.map(toItemJson));
});

async function findDuplicate(db: D1Database, urlNorm: string, excludeId?: number) {
  if (!urlNorm) return null;
  let sql = "SELECT id, name FROM items WHERE url_norm = ? AND deleted_at IS NULL";
  const args: (string | number)[] = [urlNorm];
  if (excludeId != null) {
    sql += " AND id != ?";
    args.push(excludeId);
  }
  return db
    .prepare(sql)
    .bind(...args)
    .first<{ id: number; name: string }>();
}

itemRoutes.post("/import", async (c) => {
  const body = await c.req.json<{
    format?: "markdown" | "json" | "html";
    content?: string;
    dryRun?: boolean;
  }>();
  if (!body.content || !body.format) {
    return c.json({ error: "format and content required" }, 400);
  }
  let rows: ImportRow[];
  try {
    rows =
      body.format === "markdown"
        ? parseMarkdownTables(body.content)
        : body.format === "html"
          ? parseBookmarksHtml(body.content)
          : parseJsonItems(body.content);
  } catch {
    return c.json({ error: "解析失败，请检查内容格式是否正确" }, 400);
  }
  if (rows.length === 0) {
    return c.json({ error: "没有识别到可导入的收藏" }, 400);
  }

  const seen = new Set<string>();
  const now = Date.now();
  let inserted = 0;
  let skipped = 0;
  const preview: (ImportRow & { skipped: boolean })[] = [];
  const stmts: D1PreparedStatement[] = [];

  for (const row of rows) {
    const urlNorm = normalizeUrl(row.url);
    const isDup =
      !!urlNorm &&
      (seen.has(urlNorm) || !!(await findDuplicate(c.env.DB, urlNorm)));
    if (preview.length < 20) preview.push({ ...row, skipped: isDup });
    if (isDup) {
      skipped++;
      continue;
    }
    if (urlNorm) seen.add(urlNorm);
    inserted++;
    if (!body.dryRun) {
      stmts.push(
        c.env.DB.prepare(
          "INSERT INTO items (name, url, icon, note, category, tags, url_norm, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          row.name,
          row.url,
          row.icon ?? "",
          row.note,
          row.category,
          JSON.stringify(row.tags ?? []),
          urlNorm,
          now,
          now,
        ),
      );
    }
  }

  for (let i = 0; i < stmts.length; i += 50) {
    await c.env.DB.batch(stmts.slice(i, i + 50));
  }

  return c.json({ parsed: rows.length, inserted, skipped, preview });
});

itemRoutes.get("/export", async (c) => {
  const format = c.req.query("format") ?? "json";
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM items WHERE deleted_at IS NULL ORDER BY category, name",
  ).all<ItemRow>();
  const items = results.map(toItemJson);
  const ts = new Date().toISOString().slice(0, 10);

  if (format === "markdown") {
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.category || "未分类";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    let md = "";
    for (const [category, list] of groups) {
      md += `## ${category}\n\n| 名称 | 链接 | 备注 |\n| --- | --- | --- |\n`;
      for (const item of list) {
        md += `| ${item.name} | ${item.url} | ${item.note} |\n`;
      }
      md += "\n";
    }
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="pickit-${ts}.md"`,
      },
    });
  }

  if (format === "html") {
    let html =
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n';
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.category || "未分类";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    for (const [category, list] of groups) {
      html += `    <DT><H3>${escapeHtml(category)}</H3>\n    <DL><p>\n`;
      for (const item of list) {
        html += `        <DT><A HREF="${escapeHtml(item.url)}">${escapeHtml(item.name)}</A>\n`;
      }
      html += "    </DL><p>\n";
    }
    html += "</DL><p>\n";
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="pickit-${ts}.html"`,
      },
    });
  }

  return new Response(JSON.stringify(items, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="pickit-${ts}.json"`,
    },
  });
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

itemRoutes.get("/categories", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT DISTINCT category FROM items WHERE category != '' AND deleted_at IS NULL ORDER BY category",
  ).all<{ category: string }>();
  return c.json(results.map((r) => r.category));
});

itemRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    url?: string;
    icon?: string;
    note?: string;
    category?: string;
    tags?: string[];
    allowDuplicate?: boolean;
  }>();
  if (!body.name) return c.json({ error: "name required" }, 400);
  const urlNorm = normalizeUrl(body.url ?? "");
  if (!body.allowDuplicate) {
    const dup = await findDuplicate(c.env.DB, urlNorm);
    if (dup) return c.json({ error: "duplicate", existing: dup }, 409);
  }
  const now = Date.now();
  const { success, meta } = await c.env.DB.prepare(
    "INSERT INTO items (name, url, icon, note, category, tags, url_norm, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      body.name,
      body.url ?? "",
      body.icon ?? "",
      body.note ?? "",
      body.category ?? "",
      JSON.stringify(body.tags ?? []),
      urlNorm,
      now,
      now,
    )
    .run();
  const id = meta.last_row_id;
  const settings = await getSettings(c.env.DB);
  if (settings) {
    c.executionCtx.waitUntil(
      embedItem(c.env, Number(id), body, settings).catch(() => {}),
    );
  }
  return c.json({ id }, success ? 201 : 500);
});

itemRoutes.post("/analyze", async (c) => {
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
      headers: { "User-Agent": "Mozilla/5.0 (compatible; pickit/1.0)" },
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

async function findSimilarItems(
  db: D1Database,
  provider: Provider,
  item: { name: string; note?: string; category?: string },
) {
  const text = [item.name, item.category, item.note].filter(Boolean).join("\n");
  const vec = await embedText(provider, text);
  if (!vec) return [];
  const qf = new Float32Array(vec);

  const { results } = await db
    .prepare(
      "SELECT id, name, url, category, embedding FROM items WHERE embedding IS NOT NULL AND deleted_at IS NULL",
    )
    .all<{ id: number; name: string; url: string; category: string; embedding: ArrayBuffer }>();

  return results
    .map((r) => {
      const vf = new Float32Array(r.embedding);
      if (vf.length !== qf.length) return null;
      const { embedding: _embedding, ...rest } = r;
      return { ...rest, score: cosSim(qf, vf) };
    })
    .filter((r): r is NonNullable<typeof r> => r != null && r.score > 0.85)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

itemRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{
    name?: string;
    url?: string;
    icon?: string;
    note?: string;
    category?: string;
    tags?: string[];
    pinned?: boolean;
    allowDuplicate?: boolean;
  }>();
  const existing = await c.env.DB.prepare("SELECT * FROM items WHERE id = ?")
    .bind(id)
    .first<ItemRow>();
  if (!existing) return c.json({ error: "not found" }, 404);
  const merged = {
    name: body.name ?? existing.name,
    url: body.url ?? existing.url,
    icon: body.icon ?? existing.icon,
    note: body.note ?? existing.note,
    category: body.category ?? existing.category,
    tags: body.tags ?? JSON.parse(existing.tags || "[]"),
    pinned: body.pinned ?? !!existing.pinned,
  };
  const urlNorm = normalizeUrl(merged.url);
  if (urlNorm !== existing.url_norm && !body.allowDuplicate) {
    const dup = await findDuplicate(c.env.DB, urlNorm, id);
    if (dup) return c.json({ error: "duplicate", existing: dup }, 409);
  }
  await c.env.DB.prepare(
    "UPDATE items SET name=?, url=?, icon=?, note=?, category=?, tags=?, pinned=?, url_norm=?, updated_at=? WHERE id=?",
  )
    .bind(
      merged.name,
      merged.url,
      merged.icon,
      merged.note,
      merged.category,
      JSON.stringify(merged.tags),
      merged.pinned ? 1 : 0,
      urlNorm,
      Date.now(),
      id,
    )
    .run();
  const settings = await getSettings(c.env.DB);
  if (settings) {
    c.executionCtx.waitUntil(
      embedItem(c.env, id, merged, settings).catch(() => {}),
    );
  }
  return c.json({ ok: true });
});

itemRoutes.get("/:id/related", async (c) => {
  const id = Number(c.req.param("id"));
  const limit = Math.min(Number(c.req.query("limit")) || 6, 20);
  const row = await c.env.DB.prepare("SELECT * FROM items WHERE id = ?")
    .bind(id)
    .first<ItemRow>();
  if (!row) return c.json({ error: "not found" }, 404);

  if (row.embedding) {
    const qf = new Float32Array(row.embedding);
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM items WHERE id != ? AND embedding IS NOT NULL AND deleted_at IS NULL",
    )
      .bind(id)
      .all<ItemRow>();
    const scored = results
      .filter((r) => r.embedding && new Float32Array(r.embedding).length === qf.length)
      .map((r) => ({ row: r, score: cosSim(qf, new Float32Array(r.embedding!)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    if (scored.length > 0) return c.json(scored.map((s) => toItemJson(s.row)));
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM items WHERE id != ? AND category = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ?",
  )
    .bind(id, row.category, limit)
    .all<ItemRow>();
  return c.json(results.map(toItemJson));
});

itemRoutes.post("/:id/summarize", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await c.env.DB.prepare("SELECT * FROM items WHERE id = ?")
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

itemRoutes.post("/:id/check", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await c.env.DB.prepare("SELECT * FROM items WHERE id = ?")
    .bind(id)
    .first<ItemRow>();
  if (!row) return c.json({ error: "not found" }, 404);
  const status = await checkLink(row.url);
  const checkedAt = Date.now();
  await c.env.DB.prepare(
    "UPDATE items SET http_status=?, checked_at=? WHERE id=?",
  )
    .bind(status, checkedAt, id)
    .run();
  return c.json({ httpStatus: status, checkedAt });
});

itemRoutes.get("/duplicates", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM items WHERE deleted_at IS NULL",
  ).all<ItemRow>();

  const groups: ItemRow[][] = [];
  const used = new Set<number>();

  const byUrl = new Map<string, ItemRow[]>();
  for (const r of results) {
    if (!r.url_norm) continue;
    if (!byUrl.has(r.url_norm)) byUrl.set(r.url_norm, []);
    byUrl.get(r.url_norm)!.push(r);
  }
  for (const list of byUrl.values()) {
    if (list.length > 1) {
      groups.push(list);
      list.forEach((r) => used.add(r.id));
    }
  }

  const byCategory = new Map<string, ItemRow[]>();
  for (const r of results) {
    if (used.has(r.id) || !r.embedding) continue;
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category)!.push(r);
  }
  for (const list of byCategory.values()) {
    for (let i = 0; i < list.length; i++) {
      if (used.has(list[i].id)) continue;
      const group = [list[i]];
      const vi = new Float32Array(list[i].embedding!);
      for (let j = i + 1; j < list.length; j++) {
        if (used.has(list[j].id)) continue;
        const vj = new Float32Array(list[j].embedding!);
        if (vj.length !== vi.length) continue;
        if (cosSim(vi, vj) > 0.92) group.push(list[j]);
      }
      if (group.length > 1) {
        groups.push(group);
        group.forEach((r) => used.add(r.id));
      }
    }
  }

  return c.json(groups.map((g) => g.map(toItemJson)));
});

itemRoutes.post("/merge", async (c) => {
  const { keepId, removeIds } = await c.req.json<{
    keepId?: number;
    removeIds?: number[];
  }>();
  if (!keepId || !Array.isArray(removeIds) || removeIds.length === 0) {
    return c.json({ error: "keepId and removeIds required" }, 400);
  }
  const keep = await c.env.DB.prepare("SELECT * FROM items WHERE id = ?")
    .bind(keepId)
    .first<ItemRow>();
  if (!keep) return c.json({ error: "not found" }, 404);
  const ids = removeIds.filter((id) => id !== keepId);
  if (ids.length === 0) return c.json({ ok: true });
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await c.env.DB.prepare(
    `SELECT tags FROM items WHERE id IN (${placeholders})`,
  )
    .bind(...ids)
    .all<{ tags: string }>();
  const mergedTags = new Set<string>(JSON.parse(keep.tags || "[]"));
  for (const r of results) {
    for (const t of JSON.parse(r.tags || "[]")) mergedTags.add(t);
  }
  const now = Date.now();
  await c.env.DB.prepare("UPDATE items SET tags=?, updated_at=? WHERE id=?")
    .bind(JSON.stringify([...mergedTags]), now, keepId)
    .run();
  await c.env.DB.prepare(
    `UPDATE items SET deleted_at=? WHERE id IN (${placeholders})`,
  )
    .bind(now, ...ids)
    .run();
  return c.json({ ok: true });
});

itemRoutes.post("/organize-all", async (c) => {
  const body = await c.req
    .json<{ mode?: "missing" | "all" }>()
    .catch(() => ({}) as { mode?: "missing" | "all" });
  const mode = body.mode ?? "missing";
  const settings = await getSettings(c.env.DB);
  if (!settings || !isChatConfigured(settings)) {
    return c.json({ error: "还没有配置对话模型，请先到「设置」里完成配置" }, 400);
  }
  const existing = await getJob(c.env.DB, "organize_job");
  if (existing?.running) {
    return c.json({ error: "已有整理任务在运行，请等它完成" }, 409);
  }
  let sql = "SELECT * FROM items WHERE deleted_at IS NULL";
  if (mode === "missing") sql += " AND (category = '' OR tags = '[]')";
  const { results } = await c.env.DB.prepare(sql).all<ItemRow>();
  const job: JobState = {
    total: results.length,
    done: 0,
    failedIds: [],
    running: true,
    startedAt: Date.now(),
  };
  await saveJob(c.env.DB, "organize_job", job);
  c.executionCtx.waitUntil(runOrganizeJob(c.env, results, settings, job));
  return c.json({ queued: results.length });
});

itemRoutes.get("/organize-status", async (c) => {
  const job = await getJob(c.env.DB, "organize_job");
  return c.json(job ?? { total: 0, done: 0, failedIds: [], running: false });
});

async function runOrganizeJob(
  env: Env,
  rows: ItemRow[],
  settings: AiSettings,
  job: JobState,
) {
  const chat = createProvider(settings)?.chat;
  if (!chat) return;
  const { generateText } = await import("ai");
  const { results: catRows } = await env.DB.prepare(
    "SELECT DISTINCT category FROM items WHERE category != '' AND deleted_at IS NULL",
  ).all<{ category: string }>();
  const categories = catRows.map((r) => r.category);

  await runBatchJob(env.DB, "organize_job", rows, job, async (row) => {
    const { text } = await generateText({
      model: chat,
      system:
        "你是技术收藏库的整理助手。根据条目信息输出 JSON（不要输出其他内容）：" +
        '{"category":"分类名(简短中文,优先从已有分类中选择；都不合适才新建)","tags":["标签1","标签2"]}',
      prompt:
        `已有分类：${categories.join("、") || "（暂无）"}\n` +
        `名称：${row.name}\nURL：${row.url}\n备注：${row.note}\n` +
        `当前分类：${row.category || "（无）"}\n当前标签：${row.tags}`,
    });
    const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonStr) as { category?: string; tags?: string[] };
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.slice(0, 5)
      : JSON.parse(row.tags || "[]");
    await env.DB.prepare(
      "UPDATE items SET category=?, tags=?, updated_at=? WHERE id=?",
    )
      .bind(
        parsed.category || row.category,
        JSON.stringify(tags),
        Date.now(),
        row.id,
      )
      .run();
  });
}

itemRoutes.post("/bulk", async (c) => {
  const body = await c.req.json<{
    ids?: number[];
    action?: "delete" | "restore" | "purge" | "pin" | "unpin" | "category";
    value?: unknown;
  }>();
  const ids = (body.ids ?? [])
    .filter((n) => Number.isInteger(n))
    .slice(0, 500);
  if (ids.length === 0) return c.json({ error: "ids required" }, 400);
  const placeholders = ids.map(() => "?").join(",");
  const now = Date.now();

  switch (body.action) {
    case "delete":
      await c.env.DB.prepare(
        `UPDATE items SET deleted_at = ? WHERE id IN (${placeholders})`,
      )
        .bind(now, ...ids)
        .run();
      break;
    case "restore":
      await c.env.DB.prepare(
        `UPDATE items SET deleted_at = NULL WHERE id IN (${placeholders})`,
      )
        .bind(...ids)
        .run();
      break;
    case "purge":
      await c.env.DB.prepare(
        `DELETE FROM items WHERE id IN (${placeholders})`,
      )
        .bind(...ids)
        .run();
      break;
    case "pin":
    case "unpin":
      await c.env.DB.prepare(
        `UPDATE items SET pinned = ?, updated_at = ? WHERE id IN (${placeholders})`,
      )
        .bind(body.action === "pin" ? 1 : 0, now, ...ids)
        .run();
      break;
    case "category":
      if (typeof body.value !== "string") {
        return c.json({ error: "value required" }, 400);
      }
      await c.env.DB.prepare(
        `UPDATE items SET category = ?, updated_at = ? WHERE id IN (${placeholders})`,
      )
        .bind(body.value, now, ...ids)
        .run();
      break;
    default:
      return c.json({ error: "unknown action" }, 400);
  }
  return c.json({ ok: true, count: ids.length });
});

itemRoutes.post("/:id/visit", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare(
    "UPDATE items SET click_count = click_count + 1, last_visited_at = ? WHERE id = ?",
  )
    .bind(Date.now(), id)
    .run();
  return c.json({ ok: true });
});

itemRoutes.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("UPDATE items SET deleted_at = ? WHERE id = ?")
    .bind(Date.now(), id)
    .run();
  return c.json({ ok: true });
});

itemRoutes.post("/:id/restore", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("UPDATE items SET deleted_at = NULL WHERE id = ?")
    .bind(id)
    .run();
  return c.json({ ok: true });
});

itemRoutes.delete("/:id/purge", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

itemRoutes.post("/:id/reembed", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await c.env.DB.prepare("SELECT * FROM items WHERE id = ?")
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

itemRoutes.post("/reembed-all", async (c) => {
  const settings = await getSettings(c.env.DB);
  if (!settings || !isEmbeddingConfigured(settings)) {
    return c.json({ error: "还没有配置向量模型，请先到「设置」里完成配置" }, 400);
  }
  const existing = await getJob(c.env.DB, "reembed_job");
  if (existing?.running) {
    return c.json({ error: "已有重建任务在运行，请等它完成" }, 409);
  }
  const { results } = await c.env.DB
    .prepare("SELECT * FROM items WHERE deleted_at IS NULL")
    .all<ItemRow>();
  const job: JobState = {
    total: results.length,
    done: 0,
    failedIds: [],
    running: true,
    startedAt: Date.now(),
  };
  await saveJob(c.env.DB, "reembed_job", job);
  c.executionCtx.waitUntil(runReembedJob(c.env, results, settings, job));
  return c.json({ queued: results.length });
});

itemRoutes.get("/reembed-status", async (c) => {
  const job = await getJob(c.env.DB, "reembed_job");
  return c.json(
    job ?? { total: 0, done: 0, failedIds: [], running: false },
  );
});

itemRoutes.post("/reembed-retry", async (c) => {
  const settings = await getSettings(c.env.DB);
  if (!settings || !isEmbeddingConfigured(settings)) {
    return c.json({ error: "还没有配置向量模型，请先到「设置」里完成配置" }, 400);
  }
  const existing = await getJob(c.env.DB, "reembed_job");
  if (!existing || existing.failedIds.length === 0) {
    return c.json({ error: "没有需要重试的收藏" }, 400);
  }
  if (existing.running) {
    return c.json({ error: "已有重建任务在运行，请等它完成" }, 409);
  }
  const { results } = await c.env.DB
    .prepare(
      `SELECT * FROM items WHERE id IN (${existing.failedIds.map(() => "?").join(",")})`,
    )
    .bind(...existing.failedIds)
    .all<ItemRow>();
  const job: JobState = {
    total: results.length,
    done: 0,
    failedIds: [],
    running: true,
    startedAt: Date.now(),
  };
  await saveJob(c.env.DB, "reembed_job", job);
  c.executionCtx.waitUntil(runReembedJob(c.env, results, settings, job));
  return c.json({ queued: results.length });
});

// Registered last among GET routes: Hono matches route patterns in
// registration order, and this catch-all-looking single segment would
// otherwise shadow every other static GET route above it.
itemRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await c.env.DB.prepare(
    "SELECT * FROM items WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(id)
    .first<ItemRow>();
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(toItemJson(row));
});

async function runReembedJob(
  env: Env,
  rows: ItemRow[],
  settings: AiSettings,
  job: JobState,
) {
  await runBatchJob(env.DB, "reembed_job", rows, job, (row) =>
    embedItem(
      env,
      row.id,
      {
        name: row.name,
        url: row.url,
        note: row.note,
        category: row.category,
      },
      settings,
    ),
  );
}

export async function embedItem(
  env: Env,
  id: number,
  item: { name: string; url?: string; note?: string; category?: string },
  settings: AiSettings,
) {
  const provider = createProvider(settings);
  if (!provider?.embedding) return;
  const text = [item.name, item.category, item.note]
    .filter(Boolean)
    .join("\n");
  const vec = await embedText(provider, text);
  if (!vec) return;
  await env.DB.prepare(
    "UPDATE items SET embedding=?, embedding_model=? WHERE id=?",
  )
    .bind(
      new Uint8Array(new Float32Array(vec).buffer),
      provider.embeddingModelId,
      id,
    )
    .run();
}

export { cosSim };
