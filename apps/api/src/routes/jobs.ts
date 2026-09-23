import { Hono } from "hono";
import type { Env } from "#types";
import { getSettings } from "#settings";
import { getJob, startJob, setJobStatus, retryFailures, type JobKind, type JobState } from "#jobs";
import { JOB_MODES, jobConfigError, runJobStep, selectJobIds } from "#job-runners";

export const jobRoutes = new Hono<{ Bindings: Env; Variables: { kind: JobKind } }>();

/** Public view of a job: the pending id list is large and only useful server side. */
function view(job: JobState) {
  const { pendingIds, lockedUntil, ...rest } = job;
  return { ...rest, pending: pendingIds.length, stepping: (lockedUntil ?? 0) > Date.now() };
}

jobRoutes.use("/:kind/*", async (c, next) => {
  const kind = c.req.param("kind") as JobKind;
  if (!(kind in JOB_MODES)) return c.json({ error: "unknown job" }, 404);
  c.set("kind", kind);
  await next();
});

jobRoutes.get("/:kind/status", async (c) => c.json(view(await getJob(c.env.DB, c.var.kind))));

jobRoutes.post("/:kind/start", async (c) => {
  const kind = c.var.kind;
  const { mode = "missing" } = await c.req
    .json<{ mode?: string }>()
    .catch(() => ({}) as { mode?: string });
  if (!JOB_MODES[kind].includes(mode)) return c.json({ error: "unknown mode" }, 400);
  const settings = await getSettings(c.env.DB);
  const configError = jobConfigError(kind, settings);
  if (configError) return c.json({ error: configError }, 400);
  const current = await getJob(c.env.DB, kind);
  if (current.status === "running") {
    return c.json({ error: "任务正在运行，请先暂停再重新开始" }, 409);
  }
  const ids = await selectJobIds(c.env, kind, mode, settings!);
  return c.json(view(await startJob(c.env.DB, kind, mode, ids)));
});

jobRoutes.post("/:kind/step", async (c) => c.json(view(await runJobStep(c.env, c.var.kind))));

jobRoutes.post("/:kind/pause", async (c) =>
  c.json(view(await setJobStatus(c.env.DB, c.var.kind, "paused"))),
);

jobRoutes.post("/:kind/resume", async (c) => {
  const configError = jobConfigError(c.var.kind, await getSettings(c.env.DB));
  if (configError) return c.json({ error: configError }, 400);
  return c.json(view(await setJobStatus(c.env.DB, c.var.kind, "running")));
});

jobRoutes.post("/:kind/retry", async (c) => {
  const configError = jobConfigError(c.var.kind, await getSettings(c.env.DB));
  if (configError) return c.json({ error: configError }, 400);
  return c.json(view(await retryFailures(c.env.DB, c.var.kind)));
});
