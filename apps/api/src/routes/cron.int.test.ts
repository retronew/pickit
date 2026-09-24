import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../test/app";
import { DAILY, EVERY_MINUTE, runSchedule } from "#cron-tasks";

let t: TestApp;

beforeEach(async () => {
  t = await createTestApp();
});

const overview = () => t.json("/api/cron");
const task = async (id: string) => (await overview()).tasks.find((x: { id: string }) => x.id === id);

describe("scheduled tasks", () => {
  it("lists every task with its schedule and next run", async () => {
    const { tasks, lastTicks } = await overview();
    expect(tasks.map((x: { id: string }) => x.id)).toEqual([
      "jobs", "vectors", "previews", "content", "activity", "backup", "link_check", "audit_prune",
    ]);
    const backup = tasks.find((x: { id: string }) => x.id === "backup");
    expect(backup).toMatchObject({ cron: DAILY, lastRun: null, recent: [] });
    // Next 18:00 UTC, within a day.
    expect(new Date(backup.nextAt).getUTCHours()).toBe(18);
    expect(backup.nextAt - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    expect(lastTicks).toEqual({ [EVERY_MINUTE]: null, [DAILY]: null });
  });

  it("logs daily runs always, and per-minute runs only when they did something", async () => {
    await runSchedule(t.env, EVERY_MINUTE);
    await runSchedule(t.env, DAILY);
    const { tasks, lastTicks } = await overview();
    // An empty library: the per-minute tasks had nothing to do, so no rows.
    expect(tasks.find((x: { id: string }) => x.id === "previews").lastRun).toBeNull();
    // Daily tasks are logged; the backup is skipped without an R2 bucket.
    expect(tasks.find((x: { id: string }) => x.id === "backup").lastRun).toMatchObject({ status: "skipped", trigger: "cron" });
    expect(tasks.find((x: { id: string }) => x.id === "link_check").lastRun).toMatchObject({ status: "ok", processed: 0 });
    // Both triggers noted when they fired.
    expect(lastTicks[EVERY_MINUTE]).toEqual(expect.any(Number));
    expect(lastTicks[DAILY]).toEqual(expect.any(Number));
  });

  it("records failures with their error", async () => {
    const broken = {
      put: async () => {
        throw new Error("bucket is read-only");
      },
      list: async () => ({ objects: [], truncated: false }),
    } as unknown as R2Bucket;
    await runSchedule({ ...t.env, BACKUPS: broken }, DAILY);
    expect((await task("backup")).lastRun).toMatchObject({ status: "error", error: "bucket is read-only" });
  });

  it("runs a task now, logged as manual", async () => {
    const run = await t.json("/api/cron/audit_prune/run", { json: {} });
    expect(run).toMatchObject({ task: "audit_prune", trigger: "manual", status: "ok" });
    expect((await task("audit_prune")).recent).toHaveLength(1);
    await t.json("/api/cron/nope/run", { json: {} }, 404);
  });
});
