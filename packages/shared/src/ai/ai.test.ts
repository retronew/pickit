import { describe, expect, it } from "vitest";
import {
  normalizeBaseUrl,
  baseUrlWarnings,
  chatRequestUrls,
  embeddingRequestUrls,
  upgradeAiSettings,
  resolveEmbeddingEndpoint,
  isChatConfigured,
  isEmbeddingConfigured,
} from "./index";

describe("normalizeBaseUrl", () => {
  it("drops trailing slashes and pasted endpoint paths", () => {
    expect(normalizeBaseUrl(" https://api.x.com/v1/ ")).toBe("https://api.x.com/v1");
    expect(normalizeBaseUrl("https://api.x.com/v1/chat/completions")).toBe("https://api.x.com/v1");
    expect(normalizeBaseUrl("https://api.x.com/v1/embeddings/")).toBe("https://api.x.com/v1");
  });

  it("adds /v1 to the bare Anthropic host like the SDK does", () => {
    expect(normalizeBaseUrl("https://api.anthropic.com")).toBe("https://api.anthropic.com/v1");
  });
});

describe("baseUrlWarnings", () => {
  it("warns about a missing version segment only for custom providers", () => {
    expect(baseUrlWarnings("https://relay.example.com", true)).toHaveLength(1);
    expect(baseUrlWarnings("https://relay.example.com", false)).toHaveLength(0);
    expect(baseUrlWarnings("https://relay.example.com/v1", true)).toHaveLength(0);
  });

  it("reports a stripped endpoint path", () => {
    expect(baseUrlWarnings("https://r.example.com/v1/chat/completions", true)[0]).toContain(
      "https://r.example.com/v1",
    );
  });
});

describe("request URLs", () => {
  it("builds the URL each protocol actually calls", () => {
    expect(chatRequestUrls("openai-chat", "https://a.com/v1/", "m")[0].url).toBe(
      "POST https://a.com/v1/chat/completions",
    );
    expect(chatRequestUrls("anthropic", "https://api.anthropic.com/v1", "m")[0].url).toBe(
      "POST https://api.anthropic.com/v1/messages",
    );
    expect(chatRequestUrls("google", "https://g.com/v1beta", "gemini-x")[0].url).toBe(
      "POST https://g.com/v1beta/models/gemini-x:generateContent",
    );
    expect(embeddingRequestUrls("openai", "https://a.com/v1", "e")[0].url).toBe(
      "POST https://a.com/v1/embeddings",
    );
  });
});

describe("upgradeAiSettings", () => {
  it("converts the legacy single-endpoint config", () => {
    const s = upgradeAiSettings({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-1",
      chatModel: "deepseek-chat",
      embeddingModel: "emb",
      apiMode: "chat",
    });
    expect(s.chat).toMatchObject({
      provider: "custom",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-1",
      protocol: "openai-chat",
      model: "deepseek-chat",
    });
    expect(s.embedding).toEqual({
      provider: "custom",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-1",
      protocol: "openai",
      model: "emb",
    });
    expect(isChatConfigured(s)).toBe(true);
    expect(isEmbeddingConfigured(s)).toBe(true);
  });

  it("returns an unconfigured config for empty input", () => {
    const s = upgradeAiSettings(null);
    expect(isChatConfigured(s)).toBe(false);
    expect(isEmbeddingConfigured(s)).toBe(false);
  });
});

describe("upgrading configs that inherited the chat provider", () => {
  const chat = (protocol: "google" | "anthropic") => ({
    provider: protocol,
    baseUrl: "https://x.com/v1",
    apiKey: "k",
    protocol,
    model: "c",
  });

  it("copies the chat provider into a now independent embedding endpoint", () => {
    const s = upgradeAiSettings({
      version: 2,
      chat: chat("google"),
      embedding: { provider: "", baseUrl: "", apiKey: "", protocol: "openai", model: "gemini-embedding-001", inheritChat: true },
    });
    expect(s.embedding).toEqual({
      provider: "google",
      baseUrl: "https://x.com/v1",
      apiKey: "k",
      protocol: "google",
      model: "gemini-embedding-001",
    });
    expect(resolveEmbeddingEndpoint(s)).toEqual(s.embedding);
  });

  it("does not copy from an Anthropic chat endpoint", () => {
    const s = upgradeAiSettings({
      version: 2,
      chat: chat("anthropic"),
      embedding: { provider: "", baseUrl: "", apiKey: "", protocol: "openai", model: "x", inheritChat: true },
    });
    expect(s.embedding.provider).toBe("");
    expect(isEmbeddingConfigured(s)).toBe(false);
  });
});
