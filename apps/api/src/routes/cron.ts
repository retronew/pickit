import { Hono } from "hono";
import type { Env } from "#types";
import { cronOverview, findTask, runTask } from "#cron-tasks";

export const cronRoutes = new Hono<{ Bindings: Env }>();

cronRoutes.get("/", async (c) => c.json(await cronOverview(c.env.DB)));

/** Runs one task now ("Run now" on the settings page); always logged. */
cronRoutes.post("/:task/run", async (c) => {
  const task = findTask(c.req.param("task"));
  if (!task) return c.json({ error: "not found" }, 404);
  return c.json(await runTask(c.env, task, "manual"));
});
