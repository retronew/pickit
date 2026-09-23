import { Hono } from "hono";
import { jwt } from "hono/jwt";
import type { Env, ItemRow } from "#types";
import { authRoutes } from "#routes/auth";
import { itemRoutes } from "#routes/items";
import { searchRoutes } from "#routes/search";
import { chatRoutes } from "#routes/chat";
import { settingsRoutes } from "#routes/settings";
import { tagRoutes } from "#routes/tags";
import { shareRoutes } from "#routes/shares";
import { getApiToken } from "#settings";
import { runDailyBackup, runDeadLinkCheck } from "#cron";

const app = new Hono<{ Bindings: Env }>();

const PUBLIC_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/status",
  "/api/health",
]);

app.use("/api/*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PATHS.has(path) || path.startsWith("/api/public/")) {
    await next();
    return;
  }
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const stored = await getApiToken(c.env.DB);
    if (stored && token === stored) {
      await next();
      return;
    }
  }
  try {
    await jwt({ secret: c.env.JWT_SECRET, alg: "HS256", cookie: "pickit_token" })(c, next);
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }
});

app.route("/api/auth", authRoutes);
app.route("/api/items", itemRoutes);
app.route("/api/search", searchRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/tags", tagRoutes);
app.route("/api/shares", shareRoutes);

app.get("/api/health", (c) => c.json({ ok: true }));

interface ShareRow {
  slug: string;
  title: string;
  type: string;
  value: string;
  created_at: number;
}

app.get("/api/public/shares/:slug", async (c) => {
  const share = await c.env.DB.prepare("SELECT * FROM shares WHERE slug = ?")
    .bind(c.req.param("slug"))
    .first<ShareRow>();
  if (!share) return c.json({ error: "not found" }, 404);

  if (share.type === "item") {
    const item = await c.env.DB.prepare(
      "SELECT * FROM items WHERE id = ? AND deleted_at IS NULL",
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

export default {
  fetch: app.fetch,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runDailyBackup(env));
    ctx.waitUntil(runDeadLinkCheck(env));
  },
} satisfies ExportedHandler<Env>;
