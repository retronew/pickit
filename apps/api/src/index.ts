import { Hono } from "hono";
import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { getAuth, isAllowedEmail, enabledProviders } from "#auth";
import { itemRoutes } from "#routes/items";
import { searchRoutes } from "#routes/search";
import { chatRoutes } from "#routes/chat";
import { settingsRoutes } from "#routes/settings";
import { tagRoutes } from "#routes/tags";
import { shareRoutes } from "#routes/shares";
import { jobRoutes } from "#routes/jobs";
import { advanceRunningJobs } from "#job-runners";
import { backfillCompactVectors } from "#vectors";
import { getApiToken } from "#settings";
import { runDailyBackup, runDeadLinkCheck } from "#cron";

/** Must match the per-minute entry in wrangler.jsonc `triggers.crons`. */
const JOB_CRON = "* * * * *";

const app = new Hono<{ Bindings: Env }>();

// Better Auth owns /api/auth/* (OAuth redirects, callbacks, session, sign-out).
app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth(c.env).handler(c.req.raw));

const PUBLIC_PATHS = new Set(["/api/health"]);

app.use("/api/*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PATHS.has(path) || path.startsWith("/api/public/") || path.startsWith("/api/auth/")) {
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
  const session = await getAuth(c.env)
    .api.getSession({ headers: c.req.raw.headers })
    .catch(() => null);
  // Re-check the allowlist so removing an email revokes existing sessions.
  if (!session || !isAllowedEmail(c.env, session.user.email)) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

// Behind the auth middleware: 200 with the signed-in user, 401 otherwise.
app.get("/api/me", async (c) => {
  const session = await getAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  const user = session?.user;
  return c.json({ user: user ? { name: user.name, email: user.email, image: user.image } : null });
});

// Lets the login page show only the providers that are configured.
app.get("/api/public/auth-providers", (c) => c.json({ providers: enabledProviders(c.env) }));
app.route("/api/items", itemRoutes);
app.route("/api/search", searchRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/tags", tagRoutes);
app.route("/api/shares", shareRoutes);
app.route("/api/jobs", jobRoutes);

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

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    if (controller.cron === JOB_CRON) {
      // Keeps re-embedding / organizing jobs moving when no page drives them.
      ctx.waitUntil(advanceRunningJobs(env));
      // Fills compact vectors for embeddings stored before they existed.
      ctx.waitUntil(
        (async () => {
          for (let i = 0; i < 5 && (await backfillCompactVectors(env.DB)) > 0; i++);
        })(),
      );
      return;
    }
    ctx.waitUntil(runDailyBackup(env));
    ctx.waitUntil(runDeadLinkCheck(env));
  },
} satisfies ExportedHandler<Env>;
