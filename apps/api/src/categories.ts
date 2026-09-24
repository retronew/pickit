// Category management. A category is a "/"-separated path stored on each
// item ("前端/React" is inside "前端"). Renaming moves a category with its
// sub-categories; renaming onto an existing one merges them; deleting
// removes one level, lifting its bookmarks and sub-categories to the parent.

export interface CategoryCount {
  category: string;
  /** Active bookmarks directly in this category. */
  count: number;
  /** Including sub-categories. */
  total: number;
}

/** "/前端//React/ " → "前端/React"; "" when nothing is left. */
export function normalizeCategory(path: unknown): string {
  if (typeof path !== "string") return "";
  return path
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");
}

export const parentCategory = (path: string) => path.split("/").slice(0, -1).join("/");

const isWithin = (path: string, ancestor: string) => path === ancestor || path.startsWith(`${ancestor}/`);

/** Where `path` ends up when `from` (and everything inside it) moves to `to`. */
export function movedCategory(path: string, from: string, to: string): string {
  if (!isWithin(path, from)) return path;
  const rest = path.slice(from.length + 1);
  return [to, rest].filter(Boolean).join("/");
}

/**
 * Every category with its counts, including parents that only exist through
 * their sub-categories ("前端" when only "前端/React" has bookmarks).
 */
export async function listCategories(db: D1Database): Promise<CategoryCount[]> {
  const { results } = await db
    .prepare(
      "SELECT category, COUNT(*) AS count FROM items WHERE deleted_at IS NULL AND category != '' GROUP BY category",
    )
    .all<{ category: string; count: number }>();
  const nodes = new Map<string, CategoryCount>();
  for (const { category, count } of results) {
    const parts = category.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const path = parts.slice(0, i).join("/");
      const node = nodes.get(path) ?? { category: path, count: 0, total: 0 };
      node.total += count;
      if (i === parts.length) node.count += count;
      nodes.set(path, node);
    }
  }
  return [...nodes.values()].sort((a, b) => a.category.localeCompare(b.category));
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** Moves `from` and its sub-categories to `to` ("" = top level), on all items including the trash. */
async function moveItems(db: D1Database, from: string, to: string): Promise<number> {
  const prefix = to ? `${to}/` : "";
  const result = await db
    .prepare(
      `UPDATE items SET
         category = CASE WHEN category = ?1 THEN ?2 ELSE ?3 || substr(category, length(?1) + 2) END,
         updated_at = ?4
       WHERE category = ?1 OR category LIKE ?5 ESCAPE '\\'`,
    )
    .bind(from, to, prefix, Date.now(), `${escapeLike(from)}/%`)
    .run();
  return result.meta.changes ?? 0;
}

/** Keeps category and mix shares pointing at the renamed category. */
async function moveShares(db: D1Database, from: string, to: string) {
  const { results } = await db
    .prepare("SELECT slug, type, value FROM shares WHERE type IN ('category', 'mix')")
    .all<{ slug: string; type: string; value: string }>();
  const updates: D1PreparedStatement[] = [];
  for (const s of results) {
    let value = s.value;
    if (s.type === "category") {
      value = movedCategory(s.value, from, to);
    } else {
      try {
        const mix = JSON.parse(s.value);
        const categories = [...new Set((mix.categories ?? []).map((c: string) => movedCategory(c, from, to)))].sort();
        value = JSON.stringify({ ...mix, categories });
      } catch {
        continue;
      }
    }
    if (value && value !== s.value) {
      updates.push(db.prepare("UPDATE shares SET value = ? WHERE slug = ?").bind(value, s.slug));
    }
  }
  if (updates.length) await db.batch(updates);
}

export type RenameResult = { ok: true; affected: number } | { ok: false; error: "invalid" | "into_itself" };

/** Rename, move or merge: `from` and everything inside it becomes `to`. */
export async function renameCategory(db: D1Database, rawFrom: unknown, rawTo: unknown): Promise<RenameResult> {
  const from = normalizeCategory(rawFrom);
  const to = normalizeCategory(rawTo);
  if (!from || !to) return { ok: false, error: "invalid" };
  if (from === to) return { ok: true, affected: 0 };
  if (to.startsWith(`${from}/`)) return { ok: false, error: "into_itself" };
  const affected = await moveItems(db, from, to);
  await moveShares(db, from, to);
  return { ok: true, affected };
}

/** Removes one level: "a/b" → its bookmarks go to "a", "a/b/c" becomes "a/c". */
export async function deleteCategory(db: D1Database, raw: unknown): Promise<number | null> {
  const category = normalizeCategory(raw);
  if (!category) return null;
  return moveItems(db, category, parentCategory(category));
}
