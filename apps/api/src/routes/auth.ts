import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { Env } from "#types";

export const authRoutes = new Hono<{ Bindings: Env }>();

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

function issueToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    { sub: "owner", iat: now, exp: now + 60 * 60 * 24 * 30 },
    env.JWT_SECRET,
    "HS256",
  );
}

authRoutes.post("/login", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? "unknown";
  const since = Date.now() - RATE_LIMIT_WINDOW_MS;
  await c.env.DB.prepare("DELETE FROM login_attempts WHERE ts < ?")
    .bind(since)
    .run();
  const attempts = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM login_attempts WHERE ip = ? AND ts >= ?",
  )
    .bind(ip, since)
    .first<{ count: number }>();
  if ((attempts?.count ?? 0) >= RATE_LIMIT_MAX) {
    return c.json({ error: "尝试次数过多，请 15 分钟后再试" }, 429);
  }

  const { password } = await c.req.json<{ password?: string }>();
  if (!password || password !== c.env.APP_PASSWORD) {
    await c.env.DB.prepare("INSERT INTO login_attempts (ip, ts) VALUES (?, ?)")
      .bind(ip, Date.now())
      .run();
    return c.json({ error: "wrong password" }, 401);
  }
  const token = await issueToken(c.env);
  const secure = new URL(c.req.url).protocol === "https:";
  c.header(
    "Set-Cookie",
    `pickit_token=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
  return c.json({ ok: true });
});

authRoutes.get("/status", async (c) => {
  const cookie = c.req.header("Cookie") ?? "";
  const match = cookie.match(/pickit_token=([^;]+)/);
  if (!match) return c.json({ authenticated: false });
  try {
    await import("hono/jwt").then(({ verify }) =>
      verify(match[1], c.env.JWT_SECRET, "HS256"),
    );
    return c.json({ authenticated: true });
  } catch {
    return c.json({ authenticated: false });
  }
});

authRoutes.post("/logout", (c) => {
  c.header("Set-Cookie", "pickit_token=; HttpOnly; Path=/; Max-Age=0");
  return c.json({ ok: true });
});
