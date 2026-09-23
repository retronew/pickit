export interface ImportRow {
  name: string;
  url: string;
  note: string;
  category: string;
  tags?: string[];
  icon?: string;
}

// Notion-style Markdown tables, headed by a heading/plain-text line that
// names the category. Matches the historical scripts/import.mjs format.
export function parseMarkdownTables(md: string): ImportRow[] {
  const rows: ImportRow[] = [];
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

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1]?.toLowerCase() === "x"
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10);
      return Number.isNaN(code) ? m : String.fromCodePoint(code);
    }
    return HTML_ENTITIES[e.toLowerCase()] ?? m;
  });
}

// Netscape bookmark file format (Chrome/Firefox/Safari export). Folders
// (<H3>) become categories for the bookmarks (<A>) that follow them; this
// is a flat, single-level reading rather than a full folder tree.
export function parseBookmarksHtml(html: string): ImportRow[] {
  const rows: ImportRow[] = [];
  let category = "";
  const tagRe = /<(H3|A)\b([^>]*)>([^<]*)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    const [, tag, attrs, text] = match;
    const label = decodeEntities(text.trim());
    if (tag.toUpperCase() === "H3") {
      category = label;
      continue;
    }
    const href = attrs.match(/HREF="([^"]*)"/i)?.[1];
    if (href && /^https?:\/\//.test(href) && label) {
      rows.push({ name: label, url: href, note: "", category });
    }
  }
  return rows;
}

// Our own export format: either a flat array of items, or { items: [...] }.
export function parseJsonItems(content: string): ImportRow[] {
  const data: unknown = JSON.parse(content);
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown })?.items)
      ? (data as { items: unknown[] }).items
      : [];
  const rows: ImportRow[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name : "";
    if (!name) continue;
    rows.push({
      name,
      url: typeof item.url === "string" ? item.url : "",
      note: typeof item.note === "string" ? item.note : "",
      category: typeof item.category === "string" ? item.category : "",
      tags: Array.isArray(item.tags)
        ? item.tags.filter((t): t is string => typeof t === "string")
        : undefined,
      icon: typeof item.icon === "string" ? item.icon : undefined,
    });
  }
  return rows;
}
