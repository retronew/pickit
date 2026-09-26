// Browser Rendering settings: plan, limit and on/off as JSON; the API token
// separately (masked when read, verified with Cloudflare before it's saved).

import { Hono } from "hono";
import { sanitizeBrowserRenderSettings } from "@pickit/shared";
import type { Env } from "#types";
import {
  getBrowserRenderInfo,
  getBrowserRenderSettings,
  saveBrowserRenderSettings,
  setBrowserRenderToken,
  verifyBrowserToken,
} from "#browser-render";
import { tr } from "#i18n";

export const browserRenderRoutes = new Hono<{ Bindings: Env }>();

browserRenderRoutes.get("/", async (c) => c.json(await getBrowserRenderInfo(c.env.DB)));

browserRenderRoutes.put("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  await saveBrowserRenderSettings(c.env.DB, sanitizeBrowserRenderSettings(body));
  return c.json(await getBrowserRenderInfo(c.env.DB));
});

browserRenderRoutes.put("/token", async (c) => {
  const { token } = await c.req.json<{ token?: unknown }>().catch(() => ({ token: undefined }));
  const { accountId } = await getBrowserRenderSettings(c.env.DB);
  if (typeof token !== "string" || !token.trim() || token.length > 300 || !accountId) {
    return c.json({ error: await tr(c, "api_browser_token_invalid") }, 400);
  }
  if (!(await verifyBrowserToken(accountId, token.trim()))) {
    return c.json({ error: await tr(c, "api_browser_token_rejected") }, 400);
  }
  await setBrowserRenderToken(c.env.DB, token.trim());
  return c.json(await getBrowserRenderInfo(c.env.DB));
});

browserRenderRoutes.delete("/token", async (c) => {
  await setBrowserRenderToken(c.env.DB, null);
  return c.json(await getBrowserRenderInfo(c.env.DB));
});
