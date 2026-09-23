import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, type TestApp } from "../../test/app";
import { parseSuggestion } from "../../organize";

let t: TestApp;

async function create(item: Record<string, unknown>) {
  return (await t.json<{ id: number }>("/api/items", { json: item }, 201)).id;
}
const byName = async (name: string) =>
  (await t.json("/api/items")).find((i: { name: string }) => i.name === name);

beforeEach(async () => {
  t = await createTestApp();
});
afterEach(() => vi.unstubAllGlobals());

describe("bulk tags", () => {
  it("adds tags without duplicates and removes them", async () => {
    const a = await create({ name: "A", url: "https://a.dev", tags: ["x"] });
    const b = await create({ name: "B", url: "https://b.dev", tags: ["y"] });

    const added = await t.json("/api/items/bulk", { json: { ids: [a, b], action: "add_tags", tags: ["x", " new "] } });
    expect(added).toMatchObject({ count: 2, changed: 2 });
    expect((await byName("A")).tags).toEqual(["x", "new"]);
    expect((await byName("B")).tags).toEqual(["y", "x", "new"]);

    const removed = await t.json("/api/items/bulk", { json: { ids: [a, b], action: "remove_tags", tags: ["x"] } });
    expect(removed).toMatchObject({ changed: 2 });
    expect((await byName("A")).tags).toEqual(["new"]);

    // Nothing to change reports 0.
    expect(
      (await t.json("/api/items/bulk", { json: { ids: [a], action: "remove_tags", tags: ["zzz"] } })).changed,
    ).toBe(0);
  });

  it("requires tags", async () => {
    const a = await create({ name: "A", url: "https://a.dev" });
    await t.json("/api/items/bulk", { json: { ids: [a], action: "add_tags", tags: [" "] } }, 400);
  });
});

describe("apply reviewed updates", () => {
  it("sets category and tags per item, leaving omitted fields alone", async () => {
    const a = await create({ name: "A", url: "https://a.dev", category: "旧", tags: ["t"] });
    const b = await create({ name: "B", url: "https://b.dev", category: "旧", tags: ["t"] });
    await t.json("/api/items/bulk", {
      json: {
        action: "apply",
        updates: [
          { id: a, category: "前端", tags: ["react", "react", "ui"] },
          { id: b, tags: ["only-tags"] },
        ],
      },
    });
    expect(await byName("A")).toMatchObject({ category: "前端", tags: ["react", "ui"] });
    expect(await byName("B")).toMatchObject({ category: "旧", tags: ["only-tags"] });
  });

  it("does not touch trashed items and validates input", async () => {
    const a = await create({ name: "A", url: "https://a.dev", category: "旧" });
    await t.json(`/api/items/${a}`, { method: "DELETE" });
    await t.json("/api/items/bulk", { json: { action: "apply", updates: [{ id: a, category: "新" }] } });
    expect((await t.json("/api/items/trash"))[0].category).toBe("旧");
    await t.json("/api/items/bulk", { json: { action: "apply", updates: [] } }, 400);
  });

  it("is audited with the number of items", async () => {
    const a = await create({ name: "A", url: "https://a.dev" });
    await t.json("/api/items/bulk", { json: { action: "apply", updates: [{ id: a, category: "x" }] } });
    await t.json("/api/items/bulk", { json: { ids: [a], action: "add_tags", tags: ["k"] } });
    const [tags, apply] = (await t.json("/api/audit?category=item")).entries;
    expect(tags).toMatchObject({ action: "item.bulk_add_tags", summary: "批量添加标签 1 项：#k" });
    expect(apply).toMatchObject({ action: "item.bulk_apply", summary: "批量应用整理建议 1 项" });
  });
});

describe("parseSuggestion", () => {
  const current = { category: "旧", tags: ["a"] };

  it("reads JSON wrapped in prose or code fences", () => {
    expect(parseSuggestion('好的：```json\n{"category":"前端","tags":["ui","ui"," x "]}\n```', current)).toEqual({
      category: "前端",
      tags: ["ui", "x"],
    });
  });

  it("falls back to current values and caps tags at 5", () => {
    expect(parseSuggestion('{"tags":["1","2","3","4","5","6"]}', current)).toEqual({
      category: "旧",
      tags: ["1", "2", "3", "4", "5"],
    });
    expect(parseSuggestion('{"category":"新"}', current)).toEqual({ category: "新", tags: ["a"] });
  });

  it("rejects replies without JSON", () => {
    expect(() => parseSuggestion("抱歉，我不知道", current)).toThrow(/没有返回 JSON/);
  });
});

describe("AI suggestions", () => {
  async function configureChat() {
    await t.json("/api/settings/ai", {
      json: {
        chat: {
          provider: "custom",
          baseUrl: "https://llm.test/v1",
          apiKey: "k",
          protocol: "openai-chat",
          model: "m",
        },
        embedding: {},
      },
    });
  }

  /** Answers chat completions with `reply(prompt)`. */
  function stubModel(reply: (prompt: string) => string) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        const prompt = body.messages.at(-1).content;
        const content = reply(typeof prompt === "string" ? prompt : JSON.stringify(prompt));
        return Response.json({
          id: "x",
          object: "chat.completion",
          created: 0,
          model: "m",
          choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      }),
    );
  }

  it("needs a chat model", async () => {
    const a = await create({ name: "A", url: "https://a.dev" });
    const res = await t.json("/api/items/suggest", { json: { ids: [a] } }, 400);
    expect(res.error).toContain("对话模型");
  });

  it("returns suggestions and per-item errors without changing anything", async () => {
    const a = await create({ name: "React", url: "https://react.dev", category: "杂项", tags: ["x"] });
    const b = await create({ name: "Broken", url: "https://b.dev" });
    await configureChat();
    stubModel((prompt) =>
      prompt.includes("Broken") ? "no json here" : '{"category":"前端","tags":["react","ui"]}',
    );

    const { suggestions } = await t.json("/api/items/suggest", { json: { ids: [a, b] } });
    const react = suggestions.find((s: { id: number }) => s.id === a);
    expect(react).toMatchObject({
      name: "React",
      category: "杂项",
      tags: ["x"],
      suggested: { category: "前端", tags: ["react", "ui"] },
    });
    const broken = suggestions.find((s: { id: number }) => s.id === b);
    expect(broken.error).toContain("JSON");
    expect(broken.suggested).toBeUndefined();

    expect(await byName("React")).toMatchObject({ category: "杂项", tags: ["x"] });
  });
});
