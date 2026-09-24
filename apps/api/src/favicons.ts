// Site icons proxied through Cloudflare's edge cache, so each icon is fetched
// from the upstream service once per data center instead of on every view.

const UPSTREAM = "https://www.google.com/s2/favicons?sz=64&domain=";
/** How long the edge keeps an icon. */
const EDGE_TTL = 30 * 24 * 60 * 60;
/** How long a browser reuses it without asking again. */
const BROWSER_TTL = 7 * 24 * 60 * 60;

/** A plain hostname: labels of letters, digits and hyphens (IDNs arrive punycoded). */
export function isValidHost(host: string): boolean {
  return host.length <= 253 && /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i.test(host);
}

/**
 * The icon for `host`: from the edge cache when present, otherwise fetched
 * upstream and cached. Upstream errors pass through uncached, so the page
 * falls back to its letter placeholder and a later view tries again.
 */
export async function faviconResponse(host: string, request: Request, waitUntil: (p: Promise<unknown>) => void) {
  // The Cache API is missing in some runtimes (tests); then just proxy.
  const cache = typeof caches === "undefined" ? null : (caches as unknown as { default: Cache }).default;
  const key = new Request(new URL(`/api/public/favicon/${host}`, request.url).toString());
  const hit = await cache?.match(key);
  if (hit) return hit;

  const upstream = await fetch(UPSTREAM + encodeURIComponent(host), { signal: AbortSignal.timeout(8000) });
  if (!upstream.ok) return new Response(null, { status: upstream.status === 404 ? 404 : 502 });

  const response = new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": `public, max-age=${BROWSER_TTL}, s-maxage=${EDGE_TTL}`,
    },
  });
  if (cache) waitUntil(cache.put(key, response.clone()));
  return response;
}
