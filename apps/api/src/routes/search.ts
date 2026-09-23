import { Hono } from "hono";
import type { Env } from "#types";
import { searchItems } from "#search";

export { ftsQuery } from "#search";

export const searchRoutes = new Hono<{ Bindings: Env }>();

searchRoutes.get("/", async (c) => {
  return c.json({ hits: await searchItems(c.env, c.req.query("q") ?? "") });
});
