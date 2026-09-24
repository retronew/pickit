// Readable text of a web page, without a DOM: a few regex passes are cheap
// enough for the Workers CPU limit. It keeps the article (or main, or body),
// drops page chrome, and turns block elements into line breaks.

/** Most of an article fits well within this; longer pages are cut. */
export const MAX_TEXT = 200_000;
const MAX_HTML = 2_000_000;

/** Elements whose whole content is noise for reading. */
const DROP = ["script", "style", "noscript", "template", "svg", "canvas", "iframe", "nav", "header", "footer", "aside", "form", "button", "select"];
/** Elements that start a new line in the text. */
const BLOCK = /<\/?(?:p|div|section|article|main|h[1-6]|li|ul|ol|dl|dt|dd|pre|blockquote|figure|figcaption|table|tr|hr|br)\b[^>]*>/gi;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", copy: "©" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** The inner HTML of the first `<tag>` element, or null. */
function inner(html: string, tag: string): string | null {
  const open = html.search(new RegExp(`<${tag}\\b[^>]*>`, "i"));
  if (open < 0) return null;
  const start = html.indexOf(">", open) + 1;
  const end = html.search(new RegExp(`</${tag}\\s*>`, "i"));
  return end > start ? html.slice(start, end) : html.slice(start);
}

/** Plain text of the page's main content; "" when there's nothing readable. */
export function extractText(rawHtml: string): string {
  let html = rawHtml.slice(0, MAX_HTML).replace(/<!--[\s\S]*?-->/g, "");
  for (const tag of DROP) html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}\\s*>`, "gi"), " ");
  // The article when the page marks one, else main, else the whole body.
  const content = inner(html, "article") ?? inner(html, "main") ?? inner(html, "body") ?? html;
  const text = decodeEntities(content.replace(BLOCK, "\n").replace(/<[^>]+>/g, ""))
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
  return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
}

export type FetchedText = { ok: true; text: string } | { ok: false; error: string };

/** Downloads a page and extracts its text. Non-HTML responses count as no text. */
export async function fetchPageText(url: string, timeoutMs = 10_000): Promise<FetchedText> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PickIt/1.0)", Accept: "text/html,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml|text\/plain/i.test(type)) return { ok: true, text: "" };
    const body = await res.text();
    return { ok: true, text: /text\/plain/i.test(type) ? body.slice(0, MAX_TEXT).trim() : extractText(body) };
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 200) };
  }
}
