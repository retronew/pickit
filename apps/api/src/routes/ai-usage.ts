import { Hono } from "hono";
import type { Env } from "#types";
import { AI_USAGE_RANGES, isValidTimeZone } from "@pickit/shared";
import { pruneAiUsage, retentionInfo, setRetentionDays, usageReport } from "#ai-usage/index";
import { MAX_RETENTION_DAYS, isValidRetention } from "#audit/index";
import { tr } from "#i18n";

export const aiUsageRoutes = new Hono<{ Bindings: Env }>();

/** Usage over the last `days` local days in `tz` (an IANA zone, default UTC). */
aiUsageRoutes.get("/", async (c) => {
  const days = Number(c.req.query("days"));
  const tz = c.req.query("tz");
  const range = (AI_USAGE_RANGES as readonly number[]).includes(days) ? days : 30;
  return c.json(await usageReport(c.env.DB, range, isValidTimeZone(tz) ? tz : "UTC"));
});

aiUsageRoutes.get("/settings", async (c) => c.json(await retentionInfo(c.env.DB)));

/** Sets retention (0 = forever) and prunes right away when it got shorter. */
aiUsageRoutes.put("/settings", async (c) => {
  const body = await c.req.json<{ retentionDays?: unknown }>().catch(() => ({}) as { retentionDays?: unknown });
  if (!isValidRetention(body.retentionDays)) {
    return c.json({ error: await tr(c, "api_bad_retention", { max: MAX_RETENTION_DAYS }) }, 400);
  }
  await setRetentionDays(c.env.DB, body.retentionDays);
  const deleted = await pruneAiUsage(c.env.DB, body.retentionDays);
  return c.json({ ...(await retentionInfo(c.env.DB)), deleted });
});
