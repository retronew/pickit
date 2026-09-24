import { compareText } from "#lib/collate";

export interface CategoryCount {
  category: string;
  /** Bookmarks directly in this category. */
  count: number;
  /** Including sub-categories. */
  total: number;
}

export interface CategoryNode extends CategoryCount {
  /** The last path segment: "React" for "前端/React". */
  name: string;
  depth: number;
}

/** Categories in tree order (each parent right before its children), with depth. */
export function categoryTree(list: CategoryCount[]): CategoryNode[] {
  const segments = (c: CategoryCount) => c.category.split("/");
  return [...list]
    .sort((a, b) => {
      const sa = segments(a);
      const sb = segments(b);
      for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
        const diff = compareText(sa[i], sb[i]);
        if (diff) return diff;
      }
      return sa.length - sb.length;
    })
    .map((c) => {
      const parts = segments(c);
      return { ...c, name: parts.at(-1)!, depth: parts.length - 1 };
    });
}

/** Where a category's bookmarks go when it is deleted: its parent, or uncategorized. */
export const parentCategory = (path: string) => path.split("/").slice(0, -1).join("/");

/** True for the category itself and everything inside it. */
export const isWithinCategory = (path: string, ancestor: string) =>
  path === ancestor || path.startsWith(`${ancestor}/`);

/** "前端" + "React" → "前端/React"; an empty parent means top level. */
export const joinCategory = (parent: string, name: string) => (parent ? `${parent}/${name}` : name);
