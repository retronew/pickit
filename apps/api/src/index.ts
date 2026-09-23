import { Hono } from "hono";
import type { Env } from "#types";
import { getAuth } from "#auth";
import { auditMiddleware } from "#audit/index";
import { requireAuth } from "#auth-middleware";
import { scheduled } from "#scheduled";
import { itemRoutes } from "#routes/items/index";
import { searchRoutes } from "#routes/search";
import { chatRoutes } from "#routes/chat";
import { settingsRoutes } from "#routes/settings";
import { tagRoutes } from "#routes/tags";
import { shareRoutes } from "#routes/shares";
import { jobRoutes } from "#routes/jobs";
import { auditRoutes } from "#routes/audit";
import { publicRoutes } from "#routes/public";
import { backupRoutes } from "#routes/backups";

const app = new Hono<{ Bindings: Env }>();

// First, so it also sees sign-out and requests the auth middleware rejects.
app.use(
  "/api/*",
  auditMiddleware(async (c) => {
    const session = await getAuth(c.env)
      .api.getSession({ headers: c.req.raw.headers })
      .catch(() => null);
    return session?.user.email ?? null;
  }),
);

// Better Auth owns /api/auth/* (OAuth redirects, callbacks, session, sign-out).
app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth(c.env).handler(c.req.raw));

app.use("/api/*", requireAuth);

// Behind the auth middleware: 200 with the signed-in user, 401 otherwise.
app.get("/api/me", async (c) => {
  const session = await getAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  const user = session?.user;
  return c.json({ user: user ? { name: user.name, email: user.email, image: user.image } : null });
});

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/public", publicRoutes);
app.route("/api/items", itemRoutes);
app.route("/api/search", searchRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/tags", tagRoutes);
app.route("/api/shares", shareRoutes);
app.route("/api/jobs", jobRoutes);
app.route("/api/audit", auditRoutes);
app.route("/api/backups", backupRoutes);

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Env>;
