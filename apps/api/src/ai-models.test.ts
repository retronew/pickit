import { describe, expect, it } from "vitest";
import { candidateBaseUrls, listModels, parseModels } from "./ai-models";

function fakeFetch(routes: Record<string, { status: number; body?: unknown }>) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(url);
    const r = routes[url] ?? { status: 404 };
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("candidateBaseUrls", () => {
  it("also probes /v1 when the URL has no version segment", () => {
    expect(candidateBaseUrls("https://relay.com/")).toEqual([
      "https://relay.com",
      "https://relay.com/v1",
    ]);
    expect(candidateBaseUrls("https://relay.com/v1")).toEqual(["https://relay.com/v1"]);
  });
});

describe("parseModels", () => {
  it("splits an OpenAI-style list into chat and embedding models", () => {
    expect(
      parseModels("openai", { data: [{ id: "gpt-x" }, { id: "text-embedding-3-small" }] }),
    ).toEqual([
      { id: "gpt-x", kind: "chat" },
      { id: "text-embedding-3-small", kind: "embedding" },
    ]);
  });

  it("uses supportedGenerationMethods for Gemini", () => {
    expect(
      parseModels("google", {
        models: [
          { name: "models/gemini-x", supportedGenerationMethods: ["generateContent"] },
          { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
          { name: "models/aqa", supportedGenerationMethods: ["generateAnswer"] },
        ],
      }),
    ).toEqual([
      { id: "gemini-x", kind: "chat" },
      { id: "gemini-embedding-001", kind: "embedding" },
    ]);
  });

  it("rejects bodies that are not a model list", () => {
    expect(parseModels("openai", { error: "x" })).toBeNull();
  });
});

describe("listModels", () => {
  it("discovers the /v1 route on a relay entered without it", async () => {
    const { impl, calls } = fakeFetch({
      "https://relay.com/v1/models": { status: 200, body: { data: [{ id: "b" }, { id: "a" }] } },
    });
    const result = await listModels("openai", "https://relay.com", "k", impl);
    expect(calls).toEqual(["https://relay.com/models", "https://relay.com/v1/models"]);
    expect(result).toEqual({
      baseUrl: "https://relay.com/v1",
      models: [
        { id: "a", kind: "chat" },
        { id: "b", kind: "chat" },
      ],
    });
  });

  it("reports an auth failure instead of probing further", async () => {
    const { impl } = fakeFetch({ "https://r.com/v1/models": { status: 401 } });
    await expect(listModels("openai", "https://r.com/v1", "bad", impl)).rejects.toThrow("401");
  });
});
