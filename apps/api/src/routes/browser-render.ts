// Browser Rendering settings: on/off, plan and usage limit. The browser
// itself comes from the Worker's BROWSER binding, so there's no token here.

import { Hono } from "hono";
import { sanitizeBrowserRenderSettings } from "@pickit/shared";
import type { Env } from "#types";
import { getBrowserRenderInfo, saveBrowserRenderSettings } from "#browser-render";

export const browserRenderRoutes = new Hono<{ Bindings: Env }>();

browserRenderRoutes.get("/", async (c) => c.json(await getBrowserRenderInfo(c.env)));

browserRenderRoutes.put("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  await saveBrowserRenderSettings(c.env.DB, sanitizeBrowserRenderSettings(body));
  return c.json(await getBrowserRenderInfo(c.env));
});
