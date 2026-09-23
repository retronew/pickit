import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../test/app";

let t: TestApp;
let nextId = 1;

async function rpc(method: string, params?: Record<string, unknown>, auth?: boolean | string) {
  const res = await t.request("/api/mcp", {
    json: { jsonrpc: "2.0", id: nextId++, method, params },
    auth,
  });
  return { status: res.status, body: res.status === 202 ? null : await res.json() };
}

async function call(name: string, args: Record<string, unknown> = {}) {
  const { body } = await rpc("tools/call", { name, arguments: args });
  return body.result as { content: { type: string; text: string }[]; structuredContent?: any; isError: boolean };
}

beforeEach(async () => {
  t = await createTestApp();
  await t.json("/api/items", { json: { name: "Recharts", url: "https://recharts.org", note: "React 图表库", category: "前端/图表", tags: ["react", "chart"] } }, 201);
  await t.json("/api/items", { json: { name: "Hono", url: "https://hono.dev", note: "Edge web framework", category: "后端", tags: ["ts"] } }, 201);
});

describe("MCP protocol", () => {
  it("requires the API token", async () => {
    const { status } = await rpc("tools/list", undefined, false);
    expect(status).toBe(401);
  });

  it("initializes with a negotiated protocol version", async () => {
    const { body } = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(body.result).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "pickit" },
    });
    const unknown = await rpc("initialize", { protocolVersion: "1999-01-01" });
    expect(unknown.body.result.protocolVersion).toBe("2025-11-25");
  });

  it("acknowledges notifications with 202 and answers ping", async () => {
    const res = await t.request("/api/mcp", { json: { jsonrpc: "2.0", method: "notifications/initialized" } });
    expect(res.status).toBe(202);
    expect((await rpc("ping")).body).toEqual({ jsonrpc: "2.0", id: expect.any(Number), result: {} });
  });

  it("lists tools with schemas and without handlers", async () => {
    const { body } = await rpc("tools/list");
    const names = body.result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual([
      "search_bookmarks",
      "get_bookmark",
      "list_bookmarks",
      "list_categories",
      "list_tags",
      "add_bookmark",
    ]);
    for (const tool of body.result.tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool).not.toHaveProperty("run");
    }
  });

  it("reports protocol errors", async () => {
    expect((await rpc("resources/list")).body.error.code).toBe(-32601);
    expect((await rpc("tools/call", { name: "nope" })).body.error.code).toBe(-32602);
    const bad = await t.request("/api/mcp", { method: "POST", headers: { "Content-Type": "application/json" } });
    expect(bad.status).toBe(400);
    expect((await t.request("/api/mcp")).status).toBe(405);
  });
});

describe("MCP tools", () => {
  it("searches bookmarks", async () => {
    const result = await call("search_bookmarks", { query: "Recharts" });
    expect(result.isError).toBe(false);
    expect(result.structuredContent.results[0]).toMatchObject({ name: "Recharts", tags: ["react", "chart"] });
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
  });

  it("returns tool errors to the model instead of failing the request", async () => {
    const empty = await call("search_bookmarks", { query: " " });
    expect(empty).toMatchObject({ isError: true, content: [{ text: "query is required" }] });
    expect((await call("get_bookmark", { id: 999 })).isError).toBe(true);
  });

  it("gets, lists and summarizes bookmarks", async () => {
    const [first] = (await call("list_bookmarks", { category: "前端" })).structuredContent.bookmarks;
    expect(first).toMatchObject({ name: "Recharts", category: "前端/图表" });
    const got = await call("get_bookmark", { id: first.id });
    expect(got.structuredContent).toMatchObject({ name: "Recharts", note: "React 图表库", aiSummary: "" });

    expect((await call("list_bookmarks", { tag: "ts" })).structuredContent.bookmarks).toHaveLength(1);
    expect((await call("list_categories")).structuredContent.categories).toHaveLength(2);
    expect((await call("list_tags")).structuredContent.tags).toContainEqual({ tag: "react", count: 1 });
  });

  it("adds bookmarks, defaulting the name and refusing duplicates", async () => {
    const added = await call("add_bookmark", { url: "https://vite.dev/guide", tags: ["build", "build"] });
    expect(added.structuredContent).toMatchObject({ added: true, id: expect.any(Number) });
    const item = await t.json(`/api/items/${added.structuredContent.id}`);
    expect(item).toMatchObject({ name: "vite.dev", tags: ["build"] });

    const again = await call("add_bookmark", { url: "https://vite.dev/guide/" });
    expect(again.structuredContent).toMatchObject({ added: false, existing: { name: "vite.dev" } });
    expect((await call("add_bookmark", { url: "javascript:alert(1)" })).isError).toBe(true);
  });

  it("audits tool calls but not protocol chatter", async () => {
    await rpc("initialize", { protocolVersion: "2025-06-18" });
    await rpc("tools/list");
    await call("search_bookmarks", { query: "Hono" });
    const entries = (await t.json("/api/audit")).entries;
    expect(entries).toHaveLength(3); // two item.create from setup + one MCP call
    expect(entries[0]).toMatchObject({ actor: "API Token", action: "mcp.call", summary: "MCP：搜索「Hono」" });
  });
});
