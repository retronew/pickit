import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, TEST_TOKEN, type TestApp } from "../test/app";

let t: TestApp;

async function create(item: Record<string, unknown>) {
  return (await t.json<{ id: number }>("/api/items", { json: item }, 201)).id;
}

beforeEach(async () => {
  t = await createTestApp();
});

describe("authentication", () => {
  it("rejects protected routes without credentials", async () => {
    for (const path of ["/api/items", "/api/settings/ai", "/api/audit", "/api/me"]) {
      expect((await t.request(path, { auth: false })).status, path).toBe(401);
    }
    expect((await t.request("/api/items", { method: "DELETE", auth: false })).status).toBe(401);
  });

  it("rejects a wrong API token", async () => {
    expect((await t.request("/api/items", { auth: "wrong" })).status).toBe(401);
  });

  it("leaves health and public routes open", async () => {
    expect((await t.request("/api/health", { auth: false })).status).toBe(200);
    expect(await t.json("/api/public/auth-providers", { auth: false })).toEqual({ providers: [] });
  });

  it("lists only fully configured OAuth providers", async () => {
    const app = await createTestApp({
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      GITHUB_CLIENT_ID: "id-only",
    });
    expect(await app.json("/api/public/auth-providers", { auth: false })).toEqual({
      providers: ["google"],
    });
  });

  it("revokes the old token when it is reset", async () => {
    const { token } = await t.json("/api/settings/api-token/reset", { method: "POST" });
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect((await t.request("/api/items")).status).toBe(401);
    expect((await t.request("/api/items", { auth: token })).status).toBe(200);
    const masked = await t.json("/api/settings/api-token", { auth: token });
    expect(masked).toMatchObject({ configured: true });
    expect(masked.masked).not.toContain(token);
  });

  it("disables token access when the token is deleted", async () => {
    await t.json("/api/settings/api-token", { method: "DELETE" });
    expect((await t.request("/api/items", { auth: TEST_TOKEN })).status).toBe(401);
  });
});

describe("public shares", () => {
  it("shares an item publicly until revoked", async () => {
    const id = await create({ name: "Vite", url: "https://vite.dev", note: "fast", tags: ["build"] });
    const { slug } = await t.json("/api/shares", { json: { type: "item", value: String(id), title: "看看" } });
    // Sharing again reuses the link.
    expect((await t.json("/api/shares", { json: { type: "item", value: String(id) } })).slug).toBe(slug);
    expect(await t.json("/api/shares")).toEqual([
      expect.objectContaining({ slug, title: "看看", type: "item", value: String(id) }),
    ]);

    const shared = await t.json(`/api/public/shares/${slug}`, { auth: false });
    expect(shared).toEqual({
      title: "看看",
      item: { name: "Vite", url: "https://vite.dev", icon: "", note: "fast", category: "", tags: ["build"] },
    });

    await t.json(`/api/shares/${slug}`, { method: "DELETE" });
    await t.json(`/api/public/shares/${slug}`, { auth: false }, 404);
  });

  it("stops serving a shared item once it is deleted", async () => {
    const id = await create({ name: "Vite", url: "https://vite.dev" });
    const { slug } = await t.json("/api/shares", { json: { type: "item", value: String(id) } });
    await t.json(`/api/items/${id}`, { method: "DELETE" });
    await t.json(`/api/public/shares/${slug}`, { auth: false }, 404);
  });

  it("validates input", async () => {
    await t.json("/api/shares", { json: { type: "item" } }, 400);
  });
});

describe("tags", () => {
  beforeEach(async () => {
    await create({ name: "A", url: "https://a.dev", tags: ["react", "ui"] });
    await create({ name: "B", url: "https://b.dev", tags: ["react"] });
    const gone = await create({ name: "C", url: "https://c.dev", tags: ["react", "old"] });
    await t.json(`/api/items/${gone}`, { method: "DELETE" });
  });

  it("counts tags on active items", async () => {
    expect(await t.json("/api/tags")).toEqual([
      { tag: "react", count: 2 },
      { tag: "ui", count: 1 },
    ]);
  });

  it("renames a tag everywhere, merging into an existing one", async () => {
    expect(await t.json("/api/tags/rename", { json: { from: "ui", to: "react" } })).toMatchObject({
      affected: 1,
    });
    expect(await t.json("/api/tags")).toEqual([{ tag: "react", count: 2 }]);
    const a = (await t.json("/api/items")).find((i: { name: string }) => i.name === "A");
    expect(a.tags).toEqual(["react"]);
  });

  it("deletes a tag from every item", async () => {
    await t.json("/api/tags/delete", { json: { tag: "react" } });
    expect(await t.json("/api/tags")).toEqual([{ tag: "ui", count: 1 }]);
  });

  it("validates input", async () => {
    await t.json("/api/tags/rename", { json: { from: "a" } }, 400);
    await t.json("/api/tags/delete", { json: {} }, 400);
  });
});

describe("allowed emails", () => {
  it("keeps owners from the secret read-only and normalizes extra emails", async () => {
    const saved = await t.json("/api/settings/allowed-emails", {
      method: "PUT",
      json: { emails: ["Friend@Example.com", "friend@example.com", "OWNER@example.com"] },
    });
    expect(saved).toEqual({ owners: ["owner@example.com"], emails: ["friend@example.com"] });
    expect(await t.json("/api/settings/allowed-emails")).toEqual(saved);
  });

  it("rejects malformed emails", async () => {
    const res = await t.json(
      "/api/settings/allowed-emails",
      { method: "PUT", json: { emails: ["not-an-email"] } },
      400,
    );
    expect(res.error).toContain("not-an-email");
    await t.json("/api/settings/allowed-emails", { method: "PUT", json: { emails: "x" } }, 400);
  });
});

describe("AI settings", () => {
  it("never returns API keys, and keeps a saved key only for the same server", async () => {
    const endpoint = (baseUrl: string, apiKey: string) => ({
      provider: "custom",
      baseUrl,
      apiKey,
      protocol: "openai-chat",
      model: "m",
    });
    await t.json("/api/settings/ai", {
      json: { chat: endpoint("https://relay.example.com/v1", "sk-secret-123456"), embedding: {} },
    });
    let saved = await t.json("/api/settings/ai");
    expect(JSON.stringify(saved)).not.toContain("sk-secret-123456");
    expect(saved.chat.apiKey).toBe("");
    expect(saved.chat.apiKeyMasked).toMatch(/^sk-s\*+3456$/);

    // Empty key + same origin keeps it; a different origin drops it.
    await t.json("/api/settings/ai", { json: { chat: endpoint("https://relay.example.com", ""), embedding: {} } });
    saved = await t.json("/api/settings/ai");
    expect(saved.chat.apiKeyMasked).not.toBe("");
    await t.json("/api/settings/ai", { json: { chat: endpoint("https://evil.example.net/v1", ""), embedding: {} } });
    saved = await t.json("/api/settings/ai");
    expect(saved.chat.apiKeyMasked).toBe("");
  });
});
