import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, type TestApp } from "../test/app";
import { configureChat, stubChatModel } from "../test/ai";

afterEach(() => vi.unstubAllGlobals());

let t: TestApp;
const DAY = 86_400_000;

beforeEach(async () => {
  t = await createTestApp();
});

describe("AI usage", () => {
  it("records each model call with its feature and tokens", async () => {
    await configureChat(t);
    stubChatModel(() => "A summary");
    const { id } = await t.json("/api/items", { json: { name: "Vite", url: "https://vite.dev" } }, 201);
    await t.json(`/api/items/${id}/summarize`, { json: {} });

    const report = await t.json("/api/ai-usage?days=7&tz=Asia/Shanghai");
    expect(report.timeZone).toBe("Asia/Shanghai");
    expect(report.totals).toEqual({ calls: 1, failed: 0, inputTokens: 1, outputTokens: 1 });
    expect(report.byDay).toHaveLength(7);
    expect(report.byDay.at(-1).calls).toBe(1);
    expect(report.byModel).toEqual([
      expect.objectContaining({ kind: "chat", provider: "custom", model: "m", calls: 1 }),
    ]);
    expect(report.byFeature).toEqual([expect.objectContaining({ feature: "summarize", calls: 1 })]);
  });

  it("records streamed chat once the stream finishes", async () => {
    await configureChat(t);
    const sse = [
      { id: "x", object: "chat.completion.chunk", created: 0, model: "m", choices: [{ index: 0, delta: { role: "assistant", content: "Hi" } }] },
      { id: "x", object: "chat.completion.chunk", created: 0, model: "m", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
      { id: "x", object: "chat.completion.chunk", created: 0, model: "m", choices: [], usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 } },
    ]
      .map((c) => `data: ${JSON.stringify(c)}\n\n`)
      .join("") + "data: [DONE]\n\n";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse, { headers: { "Content-Type": "text/event-stream" } })));
    const res = await t.request("/api/chat", { json: { message: "hello" } });
    expect(await res.text()).toBe("Hi");

    const { totals, byFeature } = await t.json("/api/ai-usage?days=7");
    expect(totals).toEqual({ calls: 1, failed: 0, inputTokens: 7, outputTokens: 3 });
    expect(byFeature[0].feature).toBe("chat");
  });

  it("counts failed calls", async () => {
    await configureChat(t);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad key", { status: 401 })));
    const { id } = await t.json("/api/items", { json: { name: "Vite", url: "https://vite.dev" } }, 201);
    await t.request(`/api/items/${id}/summarize`, { json: {} });
    const { totals } = await t.json("/api/ai-usage?days=7");
    expect(totals.failed).toBeGreaterThan(0);
    expect(totals.failed).toBe(totals.calls);
  });

  it("prunes rows past the retention period", async () => {
    await t.db
      .prepare("INSERT INTO ai_usage (created_at, kind, feature, provider, model) VALUES (?, 'chat', 'chat', 'p', 'm')")
      .bind(Date.now() - 40 * DAY)
      .run();
    expect(await t.json("/api/ai-usage/settings")).toMatchObject({ retentionDays: 180, count: 1 });
    const res = await t.json("/api/ai-usage/settings", { method: "PUT", json: { retentionDays: 30 } });
    expect(res).toMatchObject({ retentionDays: 30, deleted: 1, count: 0 });
    await t.json("/api/ai-usage/settings", { method: "PUT", json: { retentionDays: -1 } }, 400);
  });
});
