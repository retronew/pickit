import { Hono } from "hono";
import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { enabledProviders } from "#auth";

/** Routes that work without signing in, mounted at /api/public. */
export const publicRoutes = new Hono<{ Bindings: Env }>();

// Lets the login page show only the providers that are configured.
publicRoutes.get("/auth-providers", (c) => c.json({ providers: enabledProviders(c.env) }));

interface ShareRow {
  slug: string;
  title: string;
  type: string;
  value: string;
  created_at: number;
}

publicRoutes.get("/shares/:slug", async (c) => {
  const share = await c.env.DB.prepare("SELECT * FROM shares WHERE slug = ?")
    .bind(c.req.param("slug"))
    .first<ShareRow>();
  if (!share) return c.json({ error: "not found" }, 404);

  if (share.type === "item") {
    const item = await c.env.DB.prepare(
      `SELECT ${ITEM_COLUMNS} FROM items WHERE id = ? AND deleted_at IS NULL`,
    )
      .bind(Number(share.value))
      .first<ItemRow>();
    if (!item) return c.json({ error: "not found" }, 404);
    return c.json({
      title: share.title || item.name,
      item: {
        name: item.name,
        url: item.url,
        icon: item.icon,
        note: item.note,
        category: item.category,
        tags: JSON.parse(item.tags || "[]"),
      },
    });
  }
  return c.json({ error: "unsupported share type" }, 400);
});
