import { describe, expect, it } from "vitest";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { ChatEndpoint } from "@pickit/shared";
import { testChat } from "./ai-test";
import { withReasoning } from "./ai";

const endpoint = (reasoning: ChatEndpoint["reasoning"]): ChatEndpoint => ({
  provider: "custom",
  baseUrl: "https://example.com/v1",
  apiKey: "k",
  protocol: "openai-chat",
  model: "configured-model",
  reasoning,
});

function thinkingModel(seen: { reasoning?: string }[] = []) {
  return new MockLanguageModelV4({
    doStream: async (options) => {
      seen.push({ reasoning: options.reasoning });
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "response-metadata", modelId: "served-model" },
            { type: "reasoning-start", id: "r" },
            { type: "reasoning-delta", id: "r", delta: "The user wants ok." },
            { type: "reasoning-end", id: "r" },
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: "ok" },
            { type: "text-end", id: "t" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage: {
                inputTokens: { total: 12, noCache: 12, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 30, text: 1, reasoning: 29 },
              },
            },
          ],
        }),
      };
    },
  });
}

describe("testChat", () => {
  it("reports timing, usage and the model's thinking", async () => {
    const report = await testChat(thinkingModel(), endpoint("high"));
    expect(report).toMatchObject({
      reply: "ok",
      modelId: "served-model",
      reasoning: "high",
      inputTokens: 12,
      outputTokens: 30,
      reasoningTokens: 29,
      reasoningText: "The user wants ok.",
      finishReason: "stop",
    });
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(report.firstTokenMs).toBeLessThanOrEqual(report.durationMs);
  });
});

describe("withReasoning", () => {
  it("sends the configured level, and leaves the provider default alone", async () => {
    const seen: { reasoning?: string }[] = [];
    await testChat(withReasoning(thinkingModel(seen), "none"), endpoint("none"));
    await testChat(withReasoning(thinkingModel(seen), "provider-default"), endpoint("provider-default"));
    expect(seen[0].reasoning).toBe("none");
    expect(seen[1].reasoning).not.toBe("none");
  });
});
