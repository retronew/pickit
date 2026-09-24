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
      type: "item",
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
    await t.json("/api/shares", { json: { type: "folder", value: "x" } }, 400);
    await t.json("/api/shares", { json: { type: "category", value: "  " } }, 400);
    await t.json("/api/shares", { json: { type: "item", value: "404" } }, 404);
  });

  it("shares a live category list, including sub-categories", async () => {
    await create({ name: "React", url: "https://react.dev", category: "前端/React" });
    await create({ name: "CSS", url: "https://css.dev", category: "前端" });
    await create({ name: "前端工具", url: "https://tools.dev", category: "前端工具" });
    const gone = await create({ name: "Old", url: "https://old.dev", category: "前端" });
    await t.json(`/api/items/${gone}`, { method: "DELETE" });

    const { slug } = await t.json("/api/shares", { json: { type: "category", value: "前端" } });
    const shared = await t.json(`/api/public/shares/${slug}`, { auth: false });
    expect(shared).toMatchObject({ type: "category", value: "前端", title: "前端" });
    expect(shared.items.map((i: { name: string }) => i.name).sort()).toEqual(["CSS", "React"]);
    expect(shared.items[0]).not.toHaveProperty("id");

    // Items added later show up without re-sharing.
    await create({ name: "Vue", url: "https://vue.dev", category: "前端/Vue" });
    expect((await t.json(`/api/public/shares/${slug}`, { auth: false })).items).toHaveLength(3);
  });

  it("shares a mix of categories and tags, reusing the link for the same mix", async () => {
    await create({ name: "React", url: "https://react.dev", category: "前端/React" });
    await create({ name: "Rust", url: "https://rust.dev", category: "后端" });
    await create({ name: "GPT", url: "https://gpt.dev", tags: ["ai"] });
    await create({ name: "Other", url: "https://o.dev", category: "杂项", tags: ["misc"] });

    const body = { type: "mix", categories: ["前端", "后端"], tags: ["ai", ""] };
    const { slug } = await t.json("/api/shares", { json: body });
    const shared = await t.json(`/api/public/shares/${slug}`, { auth: false });
    expect(shared).toMatchObject({ type: "mix", value: "", title: "前端 · 后端 · #ai" });
    expect(shared.items.map((i: { name: string }) => i.name).sort()).toEqual(["GPT", "React", "Rust"]);

    const again = { type: "mix", categories: ["后端", "前端"], tags: ["ai"] };
    expect((await t.json("/api/shares", { json: again })).slug).toBe(slug);
    await t.json("/api/shares", { json: { type: "mix", categories: [], tags: [" "] } }, 400);
  });

  it("shares a tag list with an escaped RSS feed", async () => {
    await create({ name: "A & <B>", url: "https://a.dev/?x=1&y=2", note: "好用", tags: ["ai"] });
    await create({ name: "Other", url: "https://o.dev", tags: ["misc"] });
    const { slug } = await t.json("/api/shares", { json: { type: "tag", value: "ai" } });
    const shared = await t.json(`/api/public/shares/${slug}`, { auth: false });
    expect(shared).toMatchObject({ type: "tag", title: "#ai" });
    expect(shared.items.map((i: { name: string }) => i.name)).toEqual(["A & <B>"]);

    const res = await t.request(`/api/public/shares/${slug}/rss`, { auth: false });
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    const rss = await res.text();
    expect(rss).toContain("<title>A &amp; &lt;B&gt;</title>");
    expect(rss).toContain("<link>https://a.dev/?x=1&amp;y=2</link>");
    expect(rss).toContain(`<link>http://localhost/s/${slug}</link>`);
    expect(rss).not.toContain("Other");
  });

  it("has no RSS feed for single-item shares", async () => {
    const id = await create({ name: "A", url: "https://a.dev" });
    const { slug } = await t.json("/api/shares", { json: { type: "item", value: String(id) } });
    await t.json(`/api/public/shares/${slug}/rss`, { auth: false }, 404);
  });

  it("shares a hand-picked collection in the picked order", async () => {
    const a = await create({ name: "A", url: "https://a.dev" });
    const b = await create({ name: "B", url: "https://b.dev" });
    const gone = await create({ name: "C", url: "https://c.dev" });
    await t.json(`/api/items/${gone}`, { method: "DELETE" });
    await t.json("/api/shares", { json: { type: "collection", ids: [] } }, 400);
    await t.json("/api/shares", { json: { type: "collection", ids: [gone] } }, 404);

    const { slug } = await t.json("/api/shares", {
      json: { type: "collection", ids: [b, a, gone, a], title: "精选" },
    });
    // Collections are never reused.
    const other = await t.json("/api/shares", { json: { type: "collection", ids: [b, a] } });
    expect(other.slug).not.toBe(slug);

    const shared = await t.json(`/api/public/shares/${slug}`, { auth: false });
    expect(shared).toMatchObject({ type: "collection", title: "精选", value: "" });
    expect(shared.items.map((i: { name: string }) => i.name)).toEqual(["B", "A"]);
    expect((await t.json("/api/shares")).find((s: { slug: string }) => s.slug === slug)).toMatchObject({
      type: "collection",
      itemCount: 2,
    });
    const res = await t.request(`/api/public/shares/${slug}/rss`, { auth: false });
    expect(await res.text()).toContain("<title>精选</title>");
  });

  it("renames shares and keeps list titles non-empty", async () => {
    await create({ name: "A", url: "https://a.dev", tags: ["ai"] });
    const { slug } = await t.json("/api/shares", { json: { type: "tag", value: "ai" } });
    expect(await t.json(`/api/shares/${slug}`, { method: "PATCH", json: { title: " AI 工具 " } })).toMatchObject({
      title: "AI 工具",
    });
    expect((await t.json(`/api/public/shares/${slug}`, { auth: false })).title).toBe("AI 工具");
    await t.json(`/api/shares/${slug}`, { method: "PATCH", json: { title: "" } }, 400);
    await t.json(`/api/shares/${slug}`, { method: "PATCH", json: { ids: [1] } }, 400);
    await t.json("/api/shares/nope", { method: "PATCH", json: { title: "x" } }, 404);
    // Sharing again with a title renames the existing link.
    expect((await t.json("/api/shares", { json: { type: "tag", value: "ai", title: "新名字" } })).slug).toBe(slug);
    expect((await t.json("/api/shares"))[0].title).toBe("新名字");
  });

  it("counts visits, skipping crawlers and repeat views", async () => {
    await create({ name: "A", url: "https://a.dev", tags: ["ai"] });
    const { slug } = await t.json("/api/shares", { json: { type: "tag", value: "ai" } });
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
    const visitor = (ip: string) => ({ "CF-Connecting-IP": ip, "User-Agent": iphone });
    // The page passes on its document.referrer; fetch's Referer is the page itself.
    const ref = encodeURIComponent("https://news.ycombinator.com/item");
    await t.json(`/api/public/shares/${slug}?ref=${ref}`, { auth: false, headers: visitor("1.1.1.1") });
    await t.json(`/api/public/shares/${slug}`, { auth: false, headers: { ...visitor("2.2.2.2"), Referer: `http://localhost/s/${slug}` } });
    // Opened from PickIt itself (the page's fetch sends the share page as Referer): direct.
    const own = encodeURIComponent("http://localhost:5175/shares");
    await t.json(`/api/public/shares/${slug}?ref=${own}`, {
      auth: false,
      headers: { ...visitor("3.3.3.3"), Referer: `http://localhost:5175/s/${slug}` },
    });
    // A refresh by the same visitor is not counted again; neither are crawlers.
    await t.json(`/api/public/shares/${slug}`, { auth: false, headers: visitor("2.2.2.2") });
    await t.json(`/api/public/shares/${slug}`, { auth: false, headers: { "User-Agent": "Twitterbot/1.0" } });
    await t.request(`/api/public/shares/${slug}/rss`, { auth: false });

    expect((await t.json("/api/shares"))[0]).toMatchObject({ viewCount: 4, lastViewedAt: expect.any(Number) });
    const stats = await t.json(`/api/shares/${slug}/stats`);
    expect(stats).toMatchObject({
      total: 4,
      last30: 4,
      visitors30: 4,
      referrers: [{ host: "news.ycombinator.com", count: 1 }],
    });
    expect(stats.byDay).toHaveLength(30);
    expect(stats.byDay.at(-1)).toMatchObject({ page: 3, rss: 1 });
    expect(stats.recent).toHaveLength(4);
    expect(stats.recent.at(-1)).toMatchObject({ referrer: "news.ycombinator.com", browser: "Safari", os: "iOS", device: "mobile" });
    await t.json("/api/shares/nope/stats", {}, 404);
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

describe("saved searches", () => {
  it("starts empty, stores a sanitized list and replaces it on each save", async () => {
    expect(await t.json("/api/settings/saved-searches")).toEqual([]);
    const saved = await t.json("/api/settings/saved-searches", {
      method: "PUT",
      json: [
        { id: "1", name: " AI ", query: "llm", category: "", tags: ["a"], sort: "created" },
        { id: "2", name: "" },
      ],
    });
    expect(saved).toEqual([{ id: "1", name: "AI", query: "llm", category: "", tags: ["a"], sort: "created" }]);
    expect(await t.json("/api/settings/saved-searches")).toEqual(saved);
    await t.json("/api/settings/saved-searches", { method: "PUT", json: [] });
    expect(await t.json("/api/settings/saved-searches")).toEqual([]);
  });
});
