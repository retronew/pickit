import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { searchItems } from "#search";
import { createItem } from "#routes/items/helpers";

// Tools exposed to AI assistants over MCP. Results are compact JSON that a
// model can read; every call runs as the API token's owner.

export interface ToolContext {
  env: Env;
  waitUntil: (p: Promise<unknown>) => void;
}

export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

/** Thrown for bad arguments; reported to the model as a tool error. */
export class ToolError extends Error {}

interface Bookmark {
  id: number;
  name: string;
  url: string;
  note: string;
  category: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
}

function bookmark(r: ItemRow): Bookmark {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    note: r.note,
    category: r.category,
    tags: JSON.parse(r.tags || "[]"),
    pinned: !!r.pinned,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? Math.trunc(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export const TOOLS: Tool[] = [
  {
    name: "search_bookmarks",
    title: "Search bookmarks",
    description:
      "Search the user's saved bookmarks by keywords or a natural-language description " +
      "(keyword + semantic search). Returns the best matches first.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords or a description of what to find" },
        limit: { type: "integer", minimum: 1, maximum: 30, default: 10 },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true },
    async run(args, { env }) {
      const query = str(args.query);
      if (!query) throw new ToolError("query is required");
      const hits = await searchItems(env, query, int(args.limit, 10, 1, 30));
      return {
        results: hits.map((h) => ({
          id: h.id,
          name: h.name,
          url: h.url,
          note: h.note,
          category: h.category,
          tags: h.tags,
          score: Number(h.score.toFixed(3)),
        })),
      };
    },
  },
  {
    name: "get_bookmark",
    title: "Get bookmark",
    description: "Get one bookmark by id, including its note and AI summary.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "integer" } },
      required: ["id"],
    },
    annotations: { readOnlyHint: true },
    async run(args, { env }) {
      const id = int(args.id, 0, 0, Number.MAX_SAFE_INTEGER);
      const row = await env.DB.prepare(
        `SELECT ${ITEM_COLUMNS} FROM items WHERE id = ? AND deleted_at IS NULL`,
      )
        .bind(id)
        .first<ItemRow>();
      if (!row) throw new ToolError(`bookmark ${id} not found`);
      return { ...bookmark(row), aiSummary: row.ai_summary ?? "" };
    },
  },
  {
    name: "list_bookmarks",
    title: "List bookmarks",
    description:
      "List bookmarks, optionally in a category (sub-categories included) or with a tag. " +
      'Sort by "recent" (default) or "popular" (most opened).',
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string" },
        tag: { type: "string" },
        sort: { type: "string", enum: ["recent", "popular"], default: "recent" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
    },
    annotations: { readOnlyHint: true },
    async run(args, { env }) {
      const where = ["deleted_at IS NULL"];
      const binds: unknown[] = [];
      const category = str(args.category);
      const tag = str(args.tag);
      if (category) {
        where.push("(category = ? OR category LIKE ?)");
        binds.push(category, `${category}/%`);
      }
      if (tag) {
        where.push("EXISTS (SELECT 1 FROM json_each(items.tags) WHERE value = ?)");
        binds.push(tag);
      }
      const order = args.sort === "popular" ? "click_count DESC, created_at DESC" : "created_at DESC";
      const { results } = await env.DB.prepare(
        `SELECT ${ITEM_COLUMNS} FROM items WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`,
      )
        .bind(...binds, int(args.limit, 20, 1, 100))
        .all<ItemRow>();
      return { bookmarks: results.map(bookmark) };
    },
  },
  {
    name: "list_categories",
    title: "List categories",
    description: "List all categories with how many bookmarks each has.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    async run(_args, { env }) {
      const { results } = await env.DB.prepare(
        `SELECT category, COUNT(*) AS count FROM items WHERE deleted_at IS NULL AND category != ''
         GROUP BY category ORDER BY count DESC`,
      ).all<{ category: string; count: number }>();
      return { categories: results };
    },
  },
  {
    name: "list_tags",
    title: "List tags",
    description: "List all tags with how many bookmarks use each.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    async run(_args, { env }) {
      const { results } = await env.DB.prepare(
        `SELECT value AS tag, COUNT(*) AS count FROM items, json_each(items.tags)
         WHERE deleted_at IS NULL AND value != '' GROUP BY value ORDER BY count DESC, tag`,
      ).all<{ tag: string; count: number }>();
      return { tags: results };
    },
  },
  {
    name: "add_bookmark",
    title: "Add bookmark",
    description:
      "Save a new bookmark. If the URL is already saved, nothing is added and the existing " +
      "bookmark is returned. Prefer existing categories (see list_categories).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "http(s) URL" },
        name: { type: "string", description: "Title; defaults to the URL's host" },
        note: { type: "string", description: "Short description, Markdown allowed" },
        category: { type: "string", description: 'e.g. "Frontend" or "Frontend/React"; prefer existing ones' },
        tags: { type: "array", items: { type: "string" }, maxItems: 10 },
      },
      required: ["url"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async run(args, { env, waitUntil }) {
      const url = str(args.url);
      let host: string;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
        host = parsed.hostname;
      } catch {
        throw new ToolError("url must be an http(s) URL");
      }
      const tags = Array.isArray(args.tags)
        ? [...new Set(args.tags.map(str).filter(Boolean))].slice(0, 10)
        : [];
      const result = await createItem(
        env,
        { name: str(args.name) || host, url, note: str(args.note), category: str(args.category), tags },
        { waitUntil },
      );
      if ("duplicate" in result) {
        return { added: false, reason: "already saved", existing: result.duplicate };
      }
      return { added: true, id: result.id };
    },
  },
];

export function findTool(name: string): Tool | undefined {
  return TOOLS.find((t) => t.name === name);
}
