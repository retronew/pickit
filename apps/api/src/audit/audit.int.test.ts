import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../test/app";
import { scheduled } from "../scheduled";

let t: TestApp;
const DAY = 86_400_000;

async function entries(query = "") {
  return (await t.json(`/api/audit${query}`)).entries as any[];
}

/** Inserts an entry directly, e.g. to backdate it. */
async function insertEntry(action: string, createdAt: number, extra: Record<string, unknown> = {}) {
  await t.db
    .prepare("INSERT INTO audit_log (created_at, actor, action, summary, status) VALUES (?, ?, ?, ?, ?)")
    .bind(createdAt, extra.actor ?? "someone", action, extra.summary ?? "", extra.status ?? 200)
    .run();
}

beforeEach(async () => {
  t = await createTestApp();
});

describe("audit middleware", () => {
  it("records writes with actor, item name, status and redacted body", async () => {
    const { id } = await t.json("/api/items", { json: { name: "Vite", url: "https://vite.dev" } }, 201);
    await t.json(`/api/items/${id}`, { method: "PUT", json: { pinned: true } });
    await t.json("/api/settings/ai", {
      json: { chat: { provider: "custom", baseUrl: "https://x", apiKey: "sk-live-secret" }, embedding: {} },
    });

    const [ai, pin, add] = await entries();
    expect(add).toMatchObject({
      actor: "API Token",
      action: "item.create",
      target: `item:${id}`,
      summary: "添加收藏「Vite」",
      status: 201,
    });
    expect(pin).toMatchObject({ action: "item.pin", summary: "置顶收藏「Vite」" });
    expect(ai.action).toBe("settings.ai_update");
    expect(JSON.stringify(ai)).not.toContain("sk-live-secret");
    expect(ai.detail.body.chat.apiKey).toBe("***");
    expect(ai.detail).toMatchObject({ method: "POST", path: "/api/settings/ai" });
  });

  it("records rejected writes as anonymous 401s, but not reads", async () => {
    await t.request("/api/items/1", { method: "DELETE", auth: false });
    await t.request("/api/items", { auth: false });
    await t.json("/api/items");
    const list = await entries();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ actor: "anonymous", action: "item.delete", status: 401 });
    expect(list[0].detail.error).toBe("unauthorized");
  });

  it("records exports but skips automatic job steps", async () => {
    await t.request("/api/items/export?format=json");
    await t.request("/api/jobs/reembed/step", { method: "POST" });
    expect((await entries()).map((e) => e.action)).toEqual(["item.export"]);
  });

  it("logs failed requests with the error message", async () => {
    await t.request("/api/items/bulk", { json: { ids: [], action: "pin" } });
    const [entry] = await entries();
    expect(entry).toMatchObject({ action: "item.bulk_pin", status: 400 });
    expect(entry.detail.error).toBe("ids required");
  });
});

describe("audit query", () => {
  beforeEach(async () => {
    const now = Date.now();
    await insertEntry("item.create", now - 3 * DAY, { actor: "a@x.com", summary: "添加收藏「Vite」" });
    await insertEntry("item.delete", now - 2 * DAY, { actor: "b@x.com", status: 500 });
    await insertEntry("tag.rename", now - 1 * DAY, { actor: "a@x.com" });
    await insertEntry("other", now, { actor: "system" });
  });

  it("filters by category, action, actor, result, keyword and time", async () => {
    const actions = async (q: string) => (await entries(q)).map((e) => e.action);
    expect(await actions("?category=item")).toEqual(["item.delete", "item.create"]);
    expect(await actions("?category=other")).toEqual(["other"]);
    expect(await actions("?action=tag.rename")).toEqual(["tag.rename"]);
    expect(await actions("?actor=a@x.com")).toEqual(["tag.rename", "item.create"]);
    expect(await actions("?result=error")).toEqual(["item.delete"]);
    expect(await actions("?result=ok")).toHaveLength(3);
    expect(await actions(`?q=${encodeURIComponent("Vite")}`)).toEqual(["item.create"]);
    const from = Date.now() - 2.5 * DAY;
    const to = Date.now() - 0.5 * DAY;
    expect(await actions(`?from=${from}&to=${to}`)).toEqual(["tag.rename", "item.delete"]);
  });

  it("pages backwards with `before` and live-polls with `after`", async () => {
    const page1 = await t.json("/api/audit?limit=2");
    expect(page1.entries).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    const page2 = await t.json(`/api/audit?limit=2&before=${page1.entries[1].id}`);
    expect(page2.hasMore).toBe(false);
    const ids = [...page1.entries, ...page2.entries].map((e: { id: number }) => e.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(new Set(ids).size).toBe(4);

    const top = page1.entries[0].id;
    expect((await entries(`?after=${top}`))).toEqual([]);
    await insertEntry("tag.delete", Date.now());
    expect((await entries(`?after=${top}`)).map((e) => e.action)).toEqual(["tag.delete"]);
  });

  it("lists facets with counts", async () => {
    const facets = await t.json("/api/audit/facets");
    expect(facets.actions).toContainEqual({ value: "item.create", count: 1 });
    expect(facets.actors[0]).toEqual({ value: "a@x.com", count: 2 });
  });
});

describe("audit retention", () => {
  it("defaults to 180 days and reports usage", async () => {
    await insertEntry("item.create", Date.now() - DAY);
    const s = await t.json("/api/audit/settings");
    expect(s.retentionDays).toBe(180);
    expect(s.stats.count).toBe(1);
    expect(s.stats.bytes).toBeGreaterThan(0);
    expect(s.stats.databaseBytes).toBeGreaterThan(0);
  });

  it("prunes immediately when shortened and keeps everything when set to forever", async () => {
    await insertEntry("item.create", Date.now() - 100 * DAY);
    await insertEntry("item.update", Date.now() - 10 * DAY);

    const res = await t.json("/api/audit/settings", { method: "PUT", json: { retentionDays: 30 } });
    expect(res).toMatchObject({ retentionDays: 30, deleted: 1 });
    // The remaining old entry plus the audit entry for this change itself.
    expect((await entries()).map((e) => e.action)).toEqual(["settings.audit_retention", "item.update"]);

    await t.json("/api/audit/settings", { method: "PUT", json: { retentionDays: 0 } });
    await insertEntry("item.create", Date.now() - 5000 * DAY);
    const cron = { cron: "0 18 * * *" } as ScheduledController;
    const pending: Promise<unknown>[] = [];
    await scheduled(cron, t.env, { waitUntil: (p: Promise<unknown>) => pending.push(p) } as ExecutionContext);
    await Promise.all(pending);
    expect((await entries("?action=item.create"))).toHaveLength(1);
  });

  it("rejects invalid values", async () => {
    for (const retentionDays of [-1, 1.5, 3651, "30", null]) {
      await t.json("/api/audit/settings", { method: "PUT", json: { retentionDays } }, 400);
    }
  });
});

describe("daily cron", () => {
  it("prunes by the saved retention and skips backup without R2", async () => {
    await t.json("/api/audit/settings", { method: "PUT", json: { retentionDays: 7 } });
    await insertEntry("item.create", Date.now() - 8 * DAY);
    await insertEntry("item.update", Date.now() - 6 * DAY);

    const pending: Promise<unknown>[] = [];
    await scheduled(
      { cron: "0 18 * * *" } as ScheduledController,
      t.env,
      { waitUntil: (p: Promise<unknown>) => pending.push(p) } as ExecutionContext,
    );
    await Promise.all(pending);

    const actions = (await entries()).map((e) => e.action);
    expect(actions).toContain("item.update");
    expect(actions).not.toContain("item.create");
    expect(actions).not.toContain("system.backup");
  });

  it("writes a backup to R2 and audits it", async () => {
    const put: string[] = [];
    const app = await createTestApp({
      BACKUPS: {
        put: async (key: string) => void put.push(key),
        list: async () => ({ objects: [] }),
        delete: async () => {},
      } as unknown as R2Bucket,
    });
    await app.json("/api/items", { json: { name: "A", url: "https://a.dev" } }, 201);
    const pending: Promise<unknown>[] = [];
    await scheduled(
      { cron: "0 18 * * *" } as ScheduledController,
      app.env,
      { waitUntil: (p: Promise<unknown>) => pending.push(p) } as ExecutionContext,
    );
    await Promise.all(pending);
    expect(put).toEqual([expect.stringMatching(/^backups\/pickit-\d{4}-\d{2}-\d{2}\.json$/)]);
    const [backup] = (await app.json("/api/audit?action=system.backup")).entries;
    expect(backup).toMatchObject({ actor: "system" });
    expect(backup.summary).toContain("1 条收藏");
  });
});
