import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, type TestApp } from "../../test/app";
import { backfillActivity } from "#activity";

let t: TestApp;
/** Fake API answers by URL; anything else is offline. */
let api: Record<string, { status?: number; body: unknown; headers?: Record<string, string> }>;
let calls: { url: string; auth: string | null }[];

beforeEach(async () => {
  t = await createTestApp({ GITHUB_TOKEN: "gh-token" });
  api = {};
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, auth: new Headers(init?.headers).get("authorization") });
      const hit = api[url];
      if (!hit) throw new Error("offline");
      return new Response(JSON.stringify(hit.body), { status: hit.status ?? 200, headers: hit.headers });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

const create = async (url: string) => (await t.json("/api/items", { json: { name: "P", url } }, 201)).id as number;
const activityOf = async (id: number) => (await t.json(`/api/items/${id}`)).activity;

describe("project activity", () => {
  it("checks a GitHub repository with the token when one is added", async () => {
    api["https://api.github.com/repos/Tresjs/tres"] = {
      body: { pushed_at: "2026-09-20T00:00:00Z", stargazers_count: 2500, archived: false },
    };
    api["https://api.github.com/repos/Tresjs/tres/releases/latest"] = {
      body: { tag_name: "v4.3.0", published_at: "2026-09-01T00:00:00Z" },
    };
    const id = await create("https://github.com/Tresjs/tres");
    expect(await activityOf(id)).toMatchObject({
      source: "github",
      lastActivityAt: Date.parse("2026-09-20T00:00:00Z"),
      stars: 2500,
      archived: false,
      latestVersion: "v4.3.0",
      latestReleaseAt: Date.parse("2026-09-01T00:00:00Z"),
    });
    expect(calls[0].auth).toBe("Bearer gh-token");
  });

  it("checks an npm package: latest version, deprecation and downloads", async () => {
    api["https://registry.npmjs.org/@dnd-kit%2Fcore"] = {
      body: { modified: "2026-05-01T00:00:00Z", "dist-tags": { latest: "6.3.1" }, versions: { "6.3.1": { deprecated: "use v7" } } },
    };
    api["https://api.npmjs.org/downloads/point/last-week/@dnd-kit/core"] = { body: { downloads: 1234567 } };
    const id = await create("https://www.npmjs.com/package/@dnd-kit/core");
    expect(await activityOf(id)).toMatchObject({
      source: "npm",
      latestVersion: "6.3.1",
      deprecated: true,
      weeklyDownloads: 1234567,
    });
  });

  it("keeps the last data when a recheck fails, and skips non-project URLs", async () => {
    api["https://api.github.com/repos/a/b"] = { body: { pushed_at: "2026-01-01T00:00:00Z", stargazers_count: 1 } };
    const id = await create("https://github.com/a/b");
    delete api["https://api.github.com/repos/a/b"];
    api["https://api.github.com/repos/a/b"] = { status: 403, body: {} };
    expect(await t.json(`/api/items/${id}/activity`, { json: {} })).toMatchObject({ stars: 1, error: "rate_limited" });

    const plain = await create("https://example.com");
    expect(await activityOf(plain)).toBeNull();
    await t.json(`/api/items/${plain}/activity`, { json: {} }, 400);
  });

  it("backfills unchecked projects from the cron", async () => {
    // Created while "offline": the check fails and is recorded.
    const id = await create("https://github.com/x/y");
    await t.env.DB.prepare("UPDATE items SET activity = '', activity_at = NULL WHERE id = ?").bind(id).run();
    api["https://api.github.com/repos/x/y"] = { body: { pushed_at: "2026-09-01T00:00:00Z", stargazers_count: 3 } };
    expect(await backfillActivity(t.env)).toBe(1);
    expect((await activityOf(id)).stars).toBe(3);
    expect(await backfillActivity(t.env)).toBe(0);
  });
});

describe("GitHub token on the settings page", () => {
  it("is verified with GitHub, shown masked, and used before the secret", async () => {
    api["https://api.github.com/rate_limit"] = {
      body: { resources: { core: { limit: 5000, remaining: 4999, reset: 1790000000 } } },
      headers: { "github-authentication-token-expiration": "2026-12-01 00:00:00 UTC" },
    };
    const saved = await t.json("/api/settings/github-token", { method: "PUT", json: { token: "ghp_settings_token_123456" } });
    expect(saved).toMatchObject({ limit: 5000 });
    expect(saved.masked).not.toContain("settings_token");
    expect(await t.json("/api/settings/github-token")).toMatchObject({ masked: saved.masked, fromSecret: false });

    api["https://api.github.com/repos/a/b"] = { body: { pushed_at: "2026-09-01T00:00:00Z", stargazers_count: 1 } };
    await create("https://github.com/a/b");
    expect(calls.find((c) => c.url === "https://api.github.com/repos/a/b")?.auth).toBe("Bearer ghp_settings_token_123456");

    // Live status: quota, and expiry from GitHub's response header.
    expect(await t.json("/api/settings/github-token/status")).toMatchObject({
      configured: true,
      valid: true,
      limit: 5000,
      remaining: 4999,
      expiresAt: Date.parse("2026-12-01T00:00:00Z"),
    });

    // Removing it falls back to the GITHUB_TOKEN secret.
    await t.json("/api/settings/github-token", { method: "DELETE" });
    expect(await t.json("/api/settings/github-token")).toEqual({ masked: null, fromSecret: true });
  });

  it("rejects a token GitHub doesn't accept, and reports a revoked one as invalid", async () => {
    api["https://api.github.com/rate_limit"] = { status: 401, body: {} };
    // The GITHUB_TOKEN secret from createTestApp is in use and GitHub now rejects it.
    expect(await t.json("/api/settings/github-token/status")).toEqual({ configured: true, reachable: true, valid: false });
    await t.json("/api/settings/github-token", { method: "PUT", json: { token: "bad" } }, 400);
    await t.json("/api/settings/github-token", { method: "PUT", json: { token: "" } }, 400);
  });
});

describe("activity batch job", () => {
  const repo = (name: string, stars: number) => {
    api[`https://api.github.com/repos/o/${name}`] = { body: { pushed_at: "2026-09-01T00:00:00Z", stargazers_count: stars } };
  };

  it("checks every project bookmark with progress, skipping other URLs", async () => {
    const a = await create("https://github.com/o/a");
    const b = await create("https://github.com/o/b");
    await create("https://example.com/not-a-project");
    repo("a", 1);
    repo("b", 2);

    const started = await t.json("/api/jobs/activity/start", { json: { mode: "all" } });
    expect(started).toMatchObject({ status: "running", total: 2, done: 0 });
    const job = await t.json("/api/jobs/activity/step", { json: {} });
    expect(job).toMatchObject({ status: "done", done: 2, failures: [] });
    expect((await activityOf(a)).stars).toBe(1);
    expect((await activityOf(b)).stars).toBe(2);

    // Everything was checked just now: nothing is due.
    expect(await t.json("/api/jobs/activity/start", { json: { mode: "missing" } })).toMatchObject({ total: 0, status: "done" });
  });

  it("pauses on GitHub's rate limit instead of failing the rest", async () => {
    await create("https://github.com/o/a");
    await create("https://github.com/o/b");
    api["https://api.github.com/repos/o/a"] = { status: 403, body: {} };
    repo("b", 2);

    await t.json("/api/jobs/activity/start", { json: { mode: "all" } });
    const job = await t.json("/api/jobs/activity/step", { json: {} });
    expect(job).toMatchObject({ status: "paused", done: 0, pending: 2 });
    expect(job.lastError).toMatch(/GitHub/);
  });
});
