import type { Env } from "#types";
import { runSchedule } from "#cron-tasks";

/**
 * Cron trigger entry point. The tasks per trigger, and their run log, live
 * in cron-tasks.ts; the triggers themselves in wrangler.jsonc.
 */
export async function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(runSchedule(env, controller.cron));
}
