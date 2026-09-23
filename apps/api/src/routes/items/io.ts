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
import { tr } from "#i18n";

/** Items grouped by category in list order ("" = uncategorized). */
function groupByCategory<T extends { category: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return groups;
}

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
    return c.json({ error: await tr(c, "api_import_parse_failed") }, 400);
  }
  if (rows.length === 0) {
    return c.json({ error: await tr(c, "api_import_empty") }, 400);
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
    const groups = groupByCategory(items);
    const header = `| ${await tr(c, "field_name")} | ${await tr(c, "field_url")} | ${await tr(c, "field_note")} |\n| --- | --- | --- |\n`;
    let md = "";
    for (const [category, list] of groups) {
      // Uncategorized items come first without a heading, so re-importing
      // them doesn't invent a category named after the heading.
      md += `${category ? `## ${category}\n\n` : ""}${header}`;
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
    for (const [category, list] of groupByCategory(items)) {
      const links = list.map(
        (item) => `        <DT><A HREF="${escapeHtml(item.url)}">${escapeHtml(item.name)}</A>\n`,
      );
      // Uncategorized items stay at the top level instead of a made-up folder.
      html += category
        ? `    <DT><H3>${escapeHtml(category)}</H3>\n    <DL><p>\n${links.join("")}    </DL><p>\n`
        : links.join("").replace(/^ {4}/gm, "");
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
