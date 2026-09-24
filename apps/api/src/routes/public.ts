import { Hono } from "hono";
import type { Env } from "#types";
import { defaultShareTitle, getShare, publicItem, sharedItem, sharedList, shareRss } from "#shares";
import { enabledProviders } from "#auth";
import { faviconResponse, isValidHost } from "#favicons";

/** Routes that work without signing in, mounted at /api/public. */
export const publicRoutes = new Hono<{ Bindings: Env }>();

// Lets the login page show only the providers that are configured.
publicRoutes.get("/auth-providers", (c) => c.json({ providers: enabledProviders(c.env) }));

// Site icons through the edge cache (public: shared pages show them too).
publicRoutes.get("/favicon/:host", async (c) => {
  const host = c.req.param("host").toLowerCase();
  if (!isValidHost(host)) return c.json({ error: "invalid host" }, 400);
  return faviconResponse(host, c.req.raw, (p) => c.executionCtx.waitUntil(p));
});

publicRoutes.get("/shares/:slug", async (c) => {
  const share = await getShare(c.env.DB, c.req.param("slug"));
  if (!share) return c.json({ error: "not found" }, 404);

  if (share.type === "item") {
    const row = await sharedItem(c.env.DB, share.value);
    if (!row) return c.json({ error: "not found" }, 404);
    const { createdAt: _createdAt, ...item } = publicItem(row);
    return c.json({ type: "item", title: share.title || row.name, item });
  }
  if (share.type === "category" || share.type === "tag") {
    const items = (await sharedList(c.env.DB, share.type, share.value)).map(publicItem);
    return c.json({
      type: share.type,
      value: share.value,
      title: share.title || defaultShareTitle(share.type, share.value),
      items,
    });
  }
  return c.json({ error: "unsupported share type" }, 400);
});

/** RSS feed of a category / tag share. */
publicRoutes.get("/shares/:slug/rss", async (c) => {
  const share = await getShare(c.env.DB, c.req.param("slug"));
  if (!share || (share.type !== "category" && share.type !== "tag")) {
    return c.json({ error: "not found" }, 404);
  }
  const items = (await sharedList(c.env.DB, share.type, share.value)).map(publicItem);
  const origin = c.env.BETTER_AUTH_URL ?? new URL(c.req.url).origin;
  return new Response(shareRss(share, items, origin), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});
