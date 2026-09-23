import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, type TestApp } from "../../test/app";
import { configureChat, stubChatModel } from "../../test/ai";

let t: TestApp;

beforeEach(async () => {
  t = await createTestApp();
  await configureChat(t);
});
afterEach(() => vi.unstubAllGlobals());

async function create(item: Record<string, unknown>) {
  return (await t.json<{ id: number }>("/api/items", { json: item }, 201)).id;
}

describe("AI output language", () => {
  it("follows the interface language by default and the AI setting when set", async () => {
    const id = await create({ name: "Hono", url: "https://hono.dev" });
    const calls = stubChatModel(() => "summary");

    await t.json(`/api/items/${id}/summarize`, { method: "POST" });
    expect(calls.at(-1)!.system).toContain("In 简体中文");

    await t.json("/api/settings/locale", { method: "PUT", json: { locale: "en" } });
    await t.json(`/api/items/${id}/summarize`, { method: "POST" });
    expect(calls.at(-1)!.system).toContain("In English");

    await t.json("/api/settings/locale", { method: "PUT", json: { aiLanguage: "ja" } });
    await t.json(`/api/items/${id}/summarize`, { method: "POST" });
    expect(calls.at(-1)!.system).toContain("In 日本語");
  });

  it("asks for organize suggestions in the AI language, reusing existing categories", async () => {
    const id = await create({ name: "React", url: "https://react.dev", category: "前端" });
    await t.json("/api/settings/locale", { method: "PUT", json: { aiLanguage: "en" } });
    const calls = stubChatModel(() => '{"category":"前端","tags":["react"]}');
    await t.json("/api/items/suggest", { json: { ids: [id] } });
    expect(calls[0].system).toContain("in English");
    expect(calls[0].prompt).toContain("Existing categories: 前端");
  });

  it("returns an empty category when the model doesn't pick one", async () => {
    stubChatModel(() => '{"name":"Vite","note":"Build tool","tags":["build"]}');
    const res = await t.json("/api/items/analyze", { json: { url: "https://vite.dev" } });
    expect(res).toMatchObject({ name: "Vite", note: "Build tool", category: "" });
  });
});

describe("translate", () => {
  it("translates note and summary without saving, then saves the reviewed text", async () => {
    const id = await create({ name: "Hono", url: "https://hono.dev", note: "轻量的 Web 框架" });
    await t.db.prepare("UPDATE items SET ai_summary = ? WHERE id = ?").bind("适合边缘计算。", id).run();
    const calls = stubChatModel(() => '{"note":"A lightweight web framework","summary":"Great for the edge."}');

    const res = await t.json(`/api/items/${id}/translate`, { json: { target: "en" } });
    expect(res).toEqual({ locale: "en", note: "A lightweight web framework", summary: "Great for the edge." });
    expect(calls[0].system).toContain("into English");
    expect(JSON.parse(calls[0].prompt)).toEqual({ note: "轻量的 Web 框架", summary: "适合边缘计算。" });
    expect((await t.json(`/api/items/${id}`)).note).toBe("轻量的 Web 框架");

    await t.json(`/api/items/${id}/translate`, { json: { save: true, note: res.note, summary: res.summary } });
    const saved = await t.json(`/api/items/${id}`);
    expect(saved).toMatchObject({ note: "A lightweight web framework", aiSummary: "Great for the edge." });
    expect(calls).toHaveLength(1);

    const [entry] = (await t.json("/api/audit?action=item.translate")).entries;
    expect(entry.summary).toBe("保存译文「Hono」");
  });

  it("defaults to the AI output language and handles bad input", async () => {
    const id = await create({ name: "A", url: "https://a.dev", note: "hello" });
    await t.json("/api/settings/locale", { method: "PUT", json: { aiLanguage: "ja" } });
    const calls = stubChatModel(() => '{"note":"こんにちは"}');
    expect((await t.json(`/api/items/${id}/translate`, { json: {} })).locale).toBe("ja");
    expect(calls[0].system).toContain("into 日本語");

    const empty = await create({ name: "B", url: "https://b.dev" });
    await t.json(`/api/items/${empty}/translate`, { json: {} }, 400);
    await t.json("/api/items/999/translate", { json: {} }, 404);
    stubChatModel(() => "sorry, no");
    await t.json(`/api/items/${id}/translate`, { json: {} }, 502);
  });
});
