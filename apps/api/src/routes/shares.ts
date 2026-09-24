import { Hono } from "hono";
import type { Env } from "#types";
import {
  collectionIds,
  defaultShareTitle,
  isShareType,
  mixTitle,
  normalizeIds,
  normalizeMix,
  sharedCollection,
  sharedItem,
  type ShareRow,
} from "#shares";
import { shareStats } from "#share-stats";
import { accessKey, hashPassword, parseAccessInput } from "#share-access";
import { tr } from "#i18n";

export const shareRoutes = new Hono<{ Bindings: Env }>();

const TITLE_MAX = 200;
const cleanTitle = (title: unknown) => (typeof title === "string" ? title.trim().slice(0, TITLE_MAX) : "");

/** A share as the owner sees it; `accessKey` lets the owner copy a working RSS link. */
async function view(r: ShareRow, secret: string) {
  return {
    slug: r.slug,
    title: r.title,
    type: r.type,
    value: r.value,
    itemCount: r.type === "collection" ? collectionIds(r.value).length : undefined,
    createdAt: r.created_at,
    viewCount: r.view_count,
    lastViewedAt: r.last_viewed_at,
    expiresAt: r.expires_at,
    hasPassword: !!r.password_hash,
    accessKey: r.password_hash ? await accessKey(secret, r.slug, r.password_hash) : undefined,
  };
}

type AccessInput = ReturnType<typeof parseAccessInput>;

/** Applies an expiry / password change; fields left undefined stay as they are. */
async function applyAccess(db: D1Database, slug: string, access: AccessInput) {
  if (access.expiresAt !== undefined) {
    await db.prepare("UPDATE shares SET expires_at = ? WHERE slug = ?").bind(access.expiresAt, slug).run();
  }
  if (access.password !== undefined) {
    const hash = access.password === null ? null : await hashPassword(access.password);
    await db.prepare("UPDATE shares SET password_hash = ? WHERE slug = ?").bind(hash, slug).run();
  }
}

/** Parses expiresAt / password from a request body; null when they're invalid. */
function accessFrom(body: { expiresAt?: unknown; password?: unknown }): AccessInput | null {
  try {
    return parseAccessInput(body);
  } catch {
    return null;
  }
}

shareRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM shares ORDER BY created_at DESC",
  ).all<ShareRow>();
  return c.json(await Promise.all(results.map((r) => view(r, c.env.BETTER_AUTH_SECRET))));
});

async function existingIds(db: D1Database, ids: number[]): Promise<number[]> {
  const { results } = await db
    .prepare("SELECT id FROM items WHERE deleted_at IS NULL AND id IN (SELECT value FROM json_each(?))")
    .bind(JSON.stringify(ids))
    .all<{ id: number }>();
  const found = new Set(results.map((r) => r.id));
  return ids.filter((id) => found.has(id));
}

shareRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    type?: string;
    value?: string;
    ids?: unknown;
    categories?: unknown;
    tags?: unknown;
    title?: string;
    expiresAt?: unknown;
    password?: unknown;
  }>();
  const access = accessFrom(body);
  if (!access) return c.json({ error: await tr(c, "api_share_invalid") }, 400);
  let title = cleanTitle(body.title);
  const now = Date.now();
  const slug = crypto.randomUUID().replace(/-/g, "").slice(0, 10);

  // A hand-picked collection is always a new link.
  if (body.type === "collection") {
    const ids = normalizeIds(body.ids);
    if (!ids) return c.json({ error: await tr(c, "api_share_invalid") }, 400);
    const found = await existingIds(c.env.DB, ids);
    if (found.length === 0) return c.json({ error: await tr(c, "api_item_not_found") }, 404);
    await c.env.DB.prepare(
      "INSERT INTO shares (slug, title, type, value, created_at) VALUES (?, ?, 'collection', ?, ?)",
    )
      .bind(slug, title || (await tr(c, "share_collection_default_title", { count: found.length })), JSON.stringify(found), now)
      .run();
    await applyAccess(c.env.DB, slug, access);
    return c.json({ slug });
  }

  // Several categories / tags: stored canonically so the same mix reuses its link.
  if (body.type === "mix") {
    const mix = normalizeMix(body.categories, body.tags);
    if (!mix) return c.json({ error: await tr(c, "api_share_invalid") }, 400);
    body.value = JSON.stringify(mix);
    title ||= mixTitle(mix);
  }

  if (!isShareType(body.type) || typeof body.value !== "string" || !body.value.trim()) {
    return c.json({ error: await tr(c, "api_share_invalid") }, 400);
  }
  const value = body.value.trim();
  if (body.type === "item" && !(await sharedItem(c.env.DB, value))) {
    return c.json({ error: await tr(c, "api_item_not_found") }, 404);
  }
  const existing = await c.env.DB.prepare(
    "SELECT slug FROM shares WHERE type = ? AND value = ?",
  )
    .bind(body.type, value)
    .first<{ slug: string }>();
  if (existing) {
    // Sharing again reuses the link; a new title given here renames it.
    if (title) {
      await c.env.DB.prepare("UPDATE shares SET title = ? WHERE slug = ?").bind(title, existing.slug).run();
    }
    await applyAccess(c.env.DB, existing.slug, access);
    return c.json({ slug: existing.slug });
  }

  await c.env.DB.prepare(
    "INSERT INTO shares (slug, title, type, value, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(slug, title || defaultShareTitle(body.type, value), body.type, value, now)
    .run();
  await applyAccess(c.env.DB, slug, access);
  return c.json({ slug });
});

/** Rename a share, replace a collection's items, or change its expiry / password. */
shareRoutes.patch("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const share = await c.env.DB.prepare("SELECT * FROM shares WHERE slug = ?").bind(slug).first<ShareRow>();
  if (!share) return c.json({ error: "not found" }, 404);
  const body = await c.req.json<{ title?: unknown; ids?: unknown; expiresAt?: unknown; password?: unknown }>();
  const access = accessFrom(body);
  if (!access) return c.json({ error: await tr(c, "api_share_invalid") }, 400);

  const title = body.title === undefined ? share.title : cleanTitle(body.title);
  if (!title && share.type !== "item") return c.json({ error: await tr(c, "api_share_title_required") }, 400);
  let value = share.value;
  if (body.ids !== undefined) {
    const ids = share.type === "collection" ? normalizeIds(body.ids) : null;
    if (!ids) return c.json({ error: await tr(c, "api_share_invalid") }, 400);
    value = JSON.stringify(await existingIds(c.env.DB, ids));
  }
  await c.env.DB.prepare("UPDATE shares SET title = ?, value = ? WHERE slug = ?").bind(title, value, slug).run();
  await applyAccess(c.env.DB, slug, access);
  const updated = await c.env.DB.prepare("SELECT * FROM shares WHERE slug = ?").bind(slug).first<ShareRow>();
  return c.json(await view(updated!, c.env.BETTER_AUTH_SECRET));
});

/** A collection's bookmarks in their current order, for reordering them. */
shareRoutes.get("/:slug/items", async (c) => {
  const share = await c.env.DB.prepare("SELECT * FROM shares WHERE slug = ?").bind(c.req.param("slug")).first<ShareRow>();
  if (!share || share.type !== "collection") return c.json({ error: "not found" }, 404);
  const rows = await sharedCollection(c.env.DB, collectionIds(share.value));
  return c.json(rows.map((r) => ({ id: r.id, name: r.name, url: r.url })));
});

shareRoutes.get("/:slug/stats", async (c) => {
  const stats = await shareStats(c.env.DB, c.req.param("slug"));
  if (!stats) return c.json({ error: "not found" }, 404);
  return c.json(stats);
});

shareRoutes.delete("/:slug", async (c) => {
  const slug = c.req.param("slug");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM shares WHERE slug = ?").bind(slug),
    c.env.DB.prepare("DELETE FROM share_visits WHERE slug = ?").bind(slug),
  ]);
  return c.json({ ok: true });
});
