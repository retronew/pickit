// Metadata read from a page's HTML: title, description, favicon, preview image.

export interface PageMeta {
  title: string;
  description: string;
  icon: string;
  /** og:image / twitter:image, absolute; "" when the page has none. */
  image: string;
}

const MAX_HTML = 300_000;

/** `<meta property|name="key" content="…">`, in either attribute order. */
function metaContent(html: string, keys: string[]): string {
  for (const key of keys) {
    const k = key.replace(":", "\\:");
    const value =
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${k}["']`, "i"))?.[1];
    if (value?.trim()) return value.trim();
  }
  return "";
}

/** Resolves `href` against `base`; "" when it isn't a usable http(s) URL. */
function absolute(href: string, base: string): string {
  if (!href) return "";
  try {
    const url = new URL(href, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/** Parses metadata out of `html`, resolving relative URLs against `pageUrl`. */
export function parsePageMeta(html: string, pageUrl: string): PageMeta {
  const origin = new URL(pageUrl).origin;
  const faviconHref = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1];
  return {
    title: html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "",
    description: metaContent(html, ["description"]),
    icon: absolute(faviconHref ?? "", pageUrl) || `${origin}/favicon.ico`,
    image: absolute(metaContent(html, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]), pageUrl),
  };
}

/**
 * Fetches `url` and parses its metadata. Never throws: a failed fetch gives
 * empty fields and the site's default favicon.
 */
export async function fetchPageMeta(url: string, timeoutMs = 8000): Promise<PageMeta> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PickIt/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const html = (await res.text()).slice(0, MAX_HTML);
    return parsePageMeta(html, res.url || url);
  } catch {
    let icon = "";
    try {
      icon = `${new URL(url).origin}/favicon.ico`;
    } catch {
      // Not a URL; leave the icon empty.
    }
    return { title: "", description: "", icon, image: "" };
  }
}
