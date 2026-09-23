import { type ItemRow, ITEM_COLUMNS } from "#types";

// Public share links (/s/:slug): a single item, or a live list of every
// active item in a category (including sub-categories) or with a tag.

export const SHARE_TYPES = ["item", "category", "tag"] as const;
export type ShareType = (typeof SHARE_TYPES)[number];

export interface ShareRow {
  slug: string;
  title: string;
  type: string;
  value: string;
  created_at: number;
}

export interface PublicItem {
  name: string;
  url: string;
  icon: string;
  note: string;
  category: string;
  tags: string[];
  createdAt: number;
}

const LIST_LIMIT = 500;

export function isShareType(type: unknown): type is ShareType {
  return SHARE_TYPES.includes(type as ShareType);
}

export function defaultShareTitle(type: ShareType, value: string): string {
  if (type === "category") return value;
  if (type === "tag") return `#${value}`;
  return "";
}

/** Only what's safe to show publicly: no ids, counters or AI summaries. */
export function publicItem(r: ItemRow): PublicItem {
  return {
    name: r.name,
    url: r.url,
    icon: r.icon,
    note: r.note,
    category: r.category,
    tags: JSON.parse(r.tags || "[]"),
    createdAt: r.created_at,
  };
}

export async function getShare(db: D1Database, slug: string): Promise<ShareRow | null> {
  return db.prepare("SELECT * FROM shares WHERE slug = ?").bind(slug).first<ShareRow>();
}

export async function sharedItem(db: D1Database, id: string): Promise<ItemRow | null> {
  return db
    .prepare(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = ? AND deleted_at IS NULL`)
    .bind(Number(id))
    .first<ItemRow>();
}

/** Active items of a category / tag share, newest first. */
export async function sharedList(db: D1Database, type: "category" | "tag", value: string): Promise<ItemRow[]> {
  const where =
    type === "category"
      ? "(category = ? OR category LIKE ? ESCAPE '\\')"
      : "EXISTS (SELECT 1 FROM json_each(items.tags) WHERE value = ?)";
  const args =
    type === "category" ? [value, `${value.replace(/[\\%_]/g, (ch) => `\\${ch}`)}/%`] : [value];
  const { results } = await db
    .prepare(
      `SELECT ${ITEM_COLUMNS} FROM items WHERE deleted_at IS NULL AND ${where}
       ORDER BY pinned DESC, created_at DESC LIMIT ${LIST_LIMIT}`,
    )
    .bind(...args)
    .all<ItemRow>();
  return results;
}

function xml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RSS 2.0 feed of a list share. */
export function shareRss(share: ShareRow, items: PublicItem[], origin: string): string {
  const page = `${origin}/s/${share.slug}`;
  const lastBuild = items.reduce((max, i) => Math.max(max, i.createdAt), share.created_at);
  const entries = items
    .map((i) => {
      const categories = [i.category, ...i.tags].filter(Boolean).map((c) => `<category>${xml(c)}</category>`);
      return [
        "<item>",
        `<title>${xml(i.name)}</title>`,
        i.url ? `<link>${xml(i.url)}</link>` : "",
        `<guid isPermaLink="false">${xml(`${share.slug}:${i.url || i.name}`)}</guid>`,
        i.note ? `<description>${xml(i.note)}</description>` : "",
        `<pubDate>${new Date(i.createdAt).toUTCString()}</pubDate>`,
        ...categories,
        "</item>",
      ].join("");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${xml(share.title || share.value)}</title>
<link>${xml(page)}</link>
<description>${xml(`PickIt 分享：${share.title || share.value}`)}</description>
<lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>
${entries}
</channel>
</rss>
`;
}
