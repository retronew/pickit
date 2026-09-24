import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../test/app";

let t: TestApp;

async function tagShare(extra: Record<string, unknown> = {}) {
  await t.json("/api/items", { json: { name: "A", url: "https://a.dev", tags: ["ai"] } }, 201);
  return (await t.json("/api/shares", { json: { type: "tag", value: "ai", ...extra } })).slug as string;
}

beforeEach(async () => {
  t = await createTestApp();
});

describe("share expiry", () => {
  it("stops serving the page and feed once expired", async () => {
    const slug = await tagShare({ expiresAt: Date.now() + 60_000 });
    await t.json(`/api/public/shares/${slug}`, { auth: false });
    expect((await t.json("/api/shares"))[0]).toMatchObject({ expiresAt: expect.any(Number), hasPassword: false });

    await t.json(`/api/shares/${slug}`, { method: "PATCH", json: { expiresAt: Date.now() - 1 } });
    expect(await t.json(`/api/public/shares/${slug}`, { auth: false }, 410)).toEqual({ error: "expired" });
    await t.json(`/api/public/shares/${slug}/rss`, { auth: false }, 410);

    // Clearing the expiry brings it back.
    await t.json(`/api/shares/${slug}`, { method: "PATCH", json: { expiresAt: null } });
    await t.json(`/api/public/shares/${slug}`, { auth: false });
  });

  it("rejects invalid values", async () => {
    await t.json("/api/items", { json: { name: "A", url: "https://a.dev", tags: ["ai"] } }, 201);
    await t.json("/api/shares", { json: { type: "tag", value: "ai", expiresAt: "soon" } }, 400);
    await t.json("/api/shares", { json: { type: "tag", value: "ai", password: 123 } }, 400);
  });
});

describe("share password", () => {
  it("locks the page until the password is entered, and the key also opens the feed", async () => {
    const slug = await tagShare({ password: "open sesame" });
    expect((await t.json("/api/shares"))[0].hasPassword).toBe(true);
    expect(await t.json(`/api/public/shares/${slug}`, { auth: false }, 401)).toEqual({ error: "password_required" });
    await t.json(`/api/public/shares/${slug}/rss`, { auth: false }, 401);

    await t.json(`/api/public/shares/${slug}/unlock`, { auth: false, json: { password: "nope" } }, 401);
    const { key } = await t.json(`/api/public/shares/${slug}/unlock`, { auth: false, json: { password: "open sesame" } });
    expect(key).toMatch(/^[0-9a-f]{32}$/);

    const shared = await t.json(`/api/public/shares/${slug}`, { auth: false, headers: { "X-Share-Key": key } });
    expect(shared.items).toHaveLength(1);
    const res = await t.request(`/api/public/shares/${slug}/rss?key=${key}`, { auth: false });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("private");
    await t.json(`/api/public/shares/${slug}`, { auth: false, headers: { "X-Share-Key": "0".repeat(32) } }, 401);

    // A new password invalidates old keys; removing it opens the link.
    await t.json(`/api/shares/${slug}`, { method: "PATCH", json: { password: "new one" } });
    await t.json(`/api/public/shares/${slug}`, { auth: false, headers: { "X-Share-Key": key } }, 401);
    await t.json(`/api/shares/${slug}`, { method: "PATCH", json: { password: null } });
    await t.json(`/api/public/shares/${slug}`, { auth: false });
  });

  it("never stores or logs the plain password", async () => {
    await tagShare({ password: "hunter2-secret" });
    const logs = JSON.stringify(await t.json("/api/audit"));
    expect(logs).not.toContain("hunter2-secret");
  });
});
