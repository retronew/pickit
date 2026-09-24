import { Hono, type Context } from "hono";
import type { Env } from "#types";
import { getShare, isListShare, publicItem, sharedItem, sharedList, shareRss, type ShareRow } from "#shares";
import { accessKey, checkAccess, verifyPassword } from "#share-access";
import { recordVisit, visitInfo, type VisitKind } from "#share-visits";
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

/** Counts a visit after the response is sent; never fails the request. */
function trackVisit(c: Context<{ Bindings: Env }>, slug: string, kind: VisitKind) {
  // The share page passes on its own document.referrer as ?ref=.
  const ref = c.req.query("ref");
  const track = async () => {
    const ownHosts = [new URL(c.req.url).host, c.env.BETTER_AUTH_URL ? new URL(c.env.BETTER_AUTH_URL).host : ""];
    const visit = await visitInfo(c.req.raw, kind, slug, ownHosts.filter(Boolean), ref);
    if (visit) await recordVisit(c.env.DB, slug, visit);
  };
  c.executionCtx.waitUntil(track().catch(() => {}));
}

type PublicContext = Context<{ Bindings: Env }>;

/** The access key from the share page (header) or an RSS link (?key=). */
const keyOf = (c: PublicContext) => c.req.header("x-share-key") ?? c.req.query("key");

/** A 410 for expired links and a 401 for locked ones; null when the share may be shown. */
async function denied(c: PublicContext, share: ShareRow) {
  const access = await checkAccess(share, keyOf(c), c.env.BETTER_AUTH_SECRET);
  if (access === "expired") return c.json({ error: "expired" }, 410);
  if (access === "locked") return c.json({ error: "password_required" }, 401);
  return null;
}

publicRoutes.get("/shares/:slug", async (c) => {
  const share = await getShare(c.env.DB, c.req.param("slug"));
  if (!share) return c.json({ error: "not found" }, 404);
  const blocked = await denied(c, share);
  if (blocked) return blocked;

  if (share.type === "item") {
    const row = await sharedItem(c.env.DB, share.value);
    if (!row) return c.json({ error: "not found" }, 404);
    const { createdAt: _createdAt, ...item } = publicItem(row);
    trackVisit(c, share.slug, "page");
    return c.json({ type: "item", title: share.title || row.name, item });
  }
  if (isListShare(share.type)) {
    const items = (await sharedList(c.env.DB, share.type, share.value)).map(publicItem);
    trackVisit(c, share.slug, "page");
    return c.json({
      type: share.type,
      // A collection's value is its id list, a mix's is JSON: nothing to show publicly.
      value: share.type === "collection" || share.type === "mix" ? "" : share.value,
      title: share.title,
      items,
    });
  }
  return c.json({ error: "unsupported share type" }, 400);
});

/** Checks a share's password; the returned key unlocks the page and its RSS feed. */
publicRoutes.post("/shares/:slug/unlock", async (c) => {
  const share = await getShare(c.env.DB, c.req.param("slug"));
  if (!share) return c.json({ error: "not found" }, 404);
  if (share.expires_at !== null && share.expires_at <= Date.now()) return c.json({ error: "expired" }, 410);
  if (!share.password_hash) return c.json({ key: "" });
  const { password } = await c.req.json<{ password?: unknown }>().catch(() => ({ password: undefined }));
  if (typeof password !== "string" || !(await verifyPassword(password, share.password_hash))) {
    return c.json({ error: "wrong_password" }, 401);
  }
  return c.json({ key: await accessKey(c.env.BETTER_AUTH_SECRET, share.slug, share.password_hash) });
});

/** RSS feed of a list share. */
publicRoutes.get("/shares/:slug/rss", async (c) => {
  const share = await getShare(c.env.DB, c.req.param("slug"));
  if (!share || !isListShare(share.type)) {
    return c.json({ error: "not found" }, 404);
  }
  const blocked = await denied(c, share);
  if (blocked) return blocked;
  trackVisit(c, share.slug, "rss");
  const items = (await sharedList(c.env.DB, share.type, share.value)).map(publicItem);
  const origin = c.env.BETTER_AUTH_URL ?? new URL(c.req.url).origin;
  return new Response(shareRss(share, items, origin), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // A protected feed must not sit in shared caches.
      "Cache-Control": share.password_hash ? "private, max-age=300" : "public, max-age=300",
    },
  });
});
