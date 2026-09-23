import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../test/app";
import { createMemoryR2 } from "../test/r2";
import { scheduled } from "../scheduled";

let t: TestApp;
let r2: ReturnType<typeof createMemoryR2>;

async function create(name: string, url: string, extra: Record<string, unknown> = {}) {
  return (await t.json<{ id: number }>("/api/items", { json: { name, url, ...extra } }, 201)).id;
}
const names = async (path = "/api/items") =>
  (await t.json(path)).map((i: { name: string }) => i.name).sort();

beforeEach(async () => {
  r2 = createMemoryR2();
  t = await createTestApp({ BACKUPS: r2.bucket });
});

describe("backups", () => {
  it("reports when R2 isn't configured", async () => {
    const bare = await createTestApp();
    expect(await bare.json("/api/backups")).toEqual({ configured: false, backups: [] });
    expect((await bare.json("/api/backups", { method: "POST" }, 503)).error).toContain("R2");
  });

  it("backs up now, lists and downloads", async () => {
    await create("A", "https://a.dev", { tags: ["x"] });
    const made = await t.json("/api/backups", { method: "POST" }, 201);
    expect(made).toMatchObject({ kind: "manual", count: 1 });
    expect(made.name).toMatch(/^pickit-\d{4}-\d{2}-\d{2}-\d{6}-manual\.json$/);

    const { configured, backups } = await t.json("/api/backups");
    expect(configured).toBe(true);
    expect(backups).toEqual([expect.objectContaining({ name: made.name, count: 1, kind: "manual" })]);

    const res = await t.request(`/api/backups/${made.name}`);
    expect(res.headers.get("content-disposition")).toContain(made.name);
    expect(await res.json()).toEqual([expect.objectContaining({ name: "A", url: "https://a.dev", tags: ["x"] })]);
  });

  it("rejects bad or unknown names", async () => {
    await t.json("/api/backups/..%2Fsecret.json", {}, 400);
    await t.json("/api/backups/pickit-1999-01-01.json", {}, 404);
    await t.json("/api/backups/pickit-1999-01-01.json/restore", { json: { mode: "merge" } }, 404);
    await t.json("/api/backups/x/restore", { json: { mode: "nuke" } }, 400);
  });

  it("merges: adds only missing URLs and keeps original dates", async () => {
    await create("A", "https://a.dev");
    await create("B", "https://b.dev");
    const { name } = await t.json("/api/backups", { method: "POST" }, 201);
    const created = (await t.json("/api/items")).find((i: { name: string }) => i.name === "B").createdAt;

    const b = (await t.json("/api/items")).find((i: { name: string }) => i.name === "B");
    await t.json(`/api/items/${b.id}`, { method: "DELETE" });
    await t.json(`/api/items/${b.id}/purge`, { method: "DELETE" });
    await create("C", "https://c.dev");

    const preview = await t.json(`/api/backups/${name}/restore`, { json: { mode: "merge", dryRun: true } });
    expect(preview).toMatchObject({ total: 2, inserted: 1, skipped: 1, trashed: 0, snapshot: null });
    expect(await names()).toEqual(["A", "C"]);

    const result = await t.json(`/api/backups/${name}/restore`, { json: { mode: "merge" } });
    expect(result).toMatchObject({ inserted: 1, skipped: 1 });
    expect(result.snapshot).toMatch(/pre-restore\.json$/);
    expect(await names()).toEqual(["A", "B", "C"]);
    const restored = (await t.json("/api/items")).find((i: { name: string }) => i.name === "B");
    expect(restored.createdAt).toBe(created);
  });

  it("replaces: trashes current items (recoverable) and restores the backup", async () => {
    await create("A", "https://a.dev");
    const { name } = await t.json("/api/backups", { method: "POST" }, 201);
    await create("New", "https://new.dev");

    const result = await t.json(`/api/backups/${name}/restore`, { json: { mode: "replace" } });
    expect(result).toMatchObject({ total: 1, inserted: 1, trashed: 2 });
    expect(await names()).toEqual(["A"]);
    expect(await names("/api/items/trash")).toEqual(["A", "New"]);

    // The snapshot taken before the restore brings everything back.
    const undo = await t.json(`/api/backups/${result.snapshot}/restore`, { json: { mode: "replace" } });
    expect(undo.inserted).toBe(2);
    expect(await names()).toEqual(["A", "New"]);
  });

  it("deletes a backup and records backup actions in the audit log", async () => {
    const { name } = await t.json("/api/backups", { method: "POST" }, 201);
    await t.request(`/api/backups/${name}`);
    await t.json(`/api/backups/${name}`, { method: "DELETE" });
    expect((await t.json("/api/backups")).backups).toEqual([]);

    const actions = (await t.json("/api/audit?category=backup")).entries.map((e: { action: string }) => e.action);
    expect(actions).toEqual(["backup.delete", "backup.download", "backup.create"]);
  });

  it("daily cron writes the day's backup and prunes ones older than 30 days", async () => {
    await create("A", "https://a.dev");
    await t.json("/api/backups", { method: "POST" }, 201);
    const [old] = [...r2.objects.keys()];
    r2.age(old, 31 * 86_400_000);

    const pending: Promise<unknown>[] = [];
    await scheduled(
      { cron: "0 18 * * *" } as ScheduledController,
      t.env,
      { waitUntil: (p: Promise<unknown>) => pending.push(p) } as ExecutionContext,
    );
    await Promise.all(pending);

    const { backups } = await t.json("/api/backups");
    expect(backups).toEqual([expect.objectContaining({ kind: "daily", count: 1 })]);
    const [entry] = (await t.json("/api/audit?action=system.backup")).entries;
    expect(entry.summary).toContain("清理旧备份 1 个");
  });
});
