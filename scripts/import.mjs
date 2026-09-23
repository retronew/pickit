#!/usr/bin/env node
// 批量导入 Notion 风格的 Markdown 表格到 PickIt D1 数据库
// 用法：
//   pnpm import                          # 使用 data/bookmarks.md，导入本地开发库
//   pnpm import -- --file my.md          # 指定文件
//   pnpm import -- --remote              # 导入线上库（需先 wrangler login 并配置 database_id）
//   pnpm import -- --remote --file my.md

import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const fileIdx = args.indexOf("--file");
const fileArg = fileIdx !== -1 ? args[fileIdx + 1] : undefined;
const file =
  fileArg ?? join(dirname(fileURLToPath(import.meta.url)), "..", "data", "bookmarks.md");

if (!existsSync(file)) {
  console.error(`文件不存在: ${file}`);
  process.exit(1);
}

const rows = parseMarkdownTables(readFileSync(file, "utf8"));
if (rows.length === 0) {
  console.error("未解析到任何数据行（需要 Markdown 表格，标题行/普通文本行作为分类）");
  process.exit(1);
}

function esc(s) {
  return s.replace(/'/g, "''");
}

// Mirrors packages/shared/src/index.ts normalizeUrl(); kept duplicated here
// since this script runs standalone via node, without the TS build step.
function normalizeUrl(url) {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

const now = Date.now();
const cols = "name, url, icon, note, category, tags, url_norm, created_at, updated_at";
const stmts = rows.map((r) => {
  const urlNorm = normalizeUrl(r.url);
  const vals = `'${esc(r.name)}', '${esc(r.url)}', '${esc(r.icon)}', '${esc(r.note)}', '${esc(r.category)}', '[]', '${esc(urlNorm)}', ${now}, ${now}`;
  if (!urlNorm) return `INSERT INTO items (${cols}) VALUES (${vals});`;
  return (
    `INSERT INTO items (${cols}) SELECT ${vals} ` +
    `WHERE NOT EXISTS (SELECT 1 FROM items WHERE url_norm = '${esc(urlNorm)}');`
  );
});

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "apps", "api");
const tmpSql = join(tmpdir(), `pickit-import-${Date.now()}.sql`);
writeFileSync(tmpSql, stmts.join("\n"), "utf8");

const mode = remote ? "--remote" : "--local";
console.log(
  `解析到 ${rows.length} 条记录，分类: ${[...new Set(rows.map((r) => r.category))].join("、")}，${remote ? "远程" : "本地"}导入中…`,
);

try {
  execSync(`npx wrangler d1 execute DB ${mode} --file=${tmpSql}`, {
    cwd: apiDir,
    stdio: "inherit",
  });
  console.log(
    "导入完成。如已配置 embedding 模型，可到设置页点「重建全部向量」补齐语义搜索。",
  );
} finally {
  try {
    unlinkSync(tmpSql);
  } catch {
    // ignore
  }
}

function parseMarkdownTables(md) {
  const rows = [];
  let category = "";
  let inTable = false;

  for (const line of md.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      inTable = false;
      continue;
    }
    const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      category = heading[1].trim();
      inTable = false;
      continue;
    }
    if (trimmed.startsWith("|")) {
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((s) => s.trim());
      if (cells.every((c) => /^-{2,}$/.test(c) || c === "")) {
        inTable = true;
        continue;
      }
      if (!inTable) continue;
      const [name = "", url = "", note = ""] = cells;
      if (name) {
        rows.push({
          name,
          url: /^https?:\/\//.test(url) ? url : "",
          icon: /^https?:\/\//.test(url)
            ? new URL(url).origin + "/favicon.ico"
            : "",
          note: note.replace(/\s+/g, " "),
          category,
        });
      }
    } else {
      category = trimmed.replace(/[:：]$/, "");
      inTable = false;
    }
  }
  return rows;
}
