// Import and export.

import { Hono } from "hono";
import {
  normalizeUrl,
  parseMarkdownTables,
  parseBookmarksHtml,
  parseJsonItems,
  type ImportRow,
} from "@pickit/shared";
import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { toItemJson, findDuplicate, escapeHtml } from "./helpers";

export const ioRoutes = new Hono<{ Bindings: Env }>();

ioRoutes.post("/import", async (c) => {
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

ioRoutes.get("/export", async (c) => {
  const format = c.req.query("format") ?? "json";
  const { results } = await c.env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM items WHERE deleted_at IS NULL ORDER BY category, name`,
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
