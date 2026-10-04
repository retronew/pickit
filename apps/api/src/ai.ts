import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel, LanguageModelMiddleware, EmbeddingModel } from "ai";
import { embed, embedMany, wrapLanguageModel, wrapEmbeddingModel, APICallError, RetryError } from "ai";
import {
  normalizeBaseUrl,
  resolveEmbeddingEndpoint,
  isEmbeddingConfigured,
  readyChatEndpoints,
  type AiSettings,
  type ChatEndpoint,
  type AiEndpoint,
  type EmbeddingProtocol,
} from "@pickit/shared";
import type { EmbeddingModelV4 } from "@ai-sdk/provider";
import { fallbackModel } from "#ai-fallback";
import { chatUsageMiddleware, embeddingUsageMiddleware, type UsageContext } from "#ai-usage/recorder";

export type { UsageContext };

export type { AiSettings };

export interface Provider {
  chat?: LanguageModel;
  embedding?: EmbeddingModel;
  embeddingModelId?: string;
}

/** Applies the configured reasoning level to every call that doesn't set its own. */
function reasoningMiddleware(reasoning: ChatEndpoint["reasoning"]): LanguageModelMiddleware {
  return {
    specificationVersion: "v4",
    transformParams: async ({ params }) => ({ ...params, reasoning: params.reasoning ?? reasoning }),
  };
}

/** The model with a default reasoning level; unchanged for "provider-default". */
export function withReasoning(model: LanguageModel, reasoning: ChatEndpoint["reasoning"] | undefined): LanguageModel {
  if (!reasoning || reasoning === "provider-default" || typeof model === "string") return model;
  return wrapLanguageModel({ model, middleware: reasoningMiddleware(reasoning) });
}

/** With `usage`, every call made through the model is recorded in ai_usage. */
export function createChatModel(e: ChatEndpoint, usage?: UsageContext): LanguageModel {
  const model = withReasoning(createBaseChatModel(e), e.reasoning);
  if (!usage || typeof model === "string") return model;
  return wrapLanguageModel({ model, middleware: chatUsageMiddleware(usage, e) });
}

/** One model over every complete chat endpoint, falling back in order; null when none is. */
export function createChatModelWithFallbacks(settings: AiSettings, usage?: UsageContext): LanguageModel | null {
  const models = readyChatEndpoints(settings).map((e) => createChatModel(e, usage)) as Parameters<
    typeof fallbackModel
  >[0];
  return models.length ? fallbackModel(models) : null;
}

function createBaseChatModel(e: ChatEndpoint) {
  const baseURL = normalizeBaseUrl(e.baseUrl);
  // Keyless endpoints (e.g. Ollama) still need a non-empty string for the SDKs.
  const apiKey = e.apiKey || "none";
  switch (e.protocol) {
    case "openai-responses":
      return createOpenAI({ baseURL, apiKey }).responses(e.model);
    case "anthropic":
      return createAnthropic({ baseURL, apiKey }).languageModel(e.model);
    case "google":
      return createGoogleGenerativeAI({ baseURL, apiKey }).languageModel(e.model);
    case "openai-chat":
    default:
      return createOpenAICompatible({ name: e.provider || "custom", baseURL, apiKey }).chatModel(
        e.model,
      );
  }
}

export function createEmbeddingModel(e: AiEndpoint<EmbeddingProtocol>, usage?: UsageContext): EmbeddingModel {
  const model = createBaseEmbeddingModel(e);
  if (!usage) return model;
  return wrapEmbeddingModel({ model, middleware: embeddingUsageMiddleware(usage, e) });
}

function createBaseEmbeddingModel(e: AiEndpoint<EmbeddingProtocol>): EmbeddingModelV4 {
  const baseURL = normalizeBaseUrl(e.baseUrl);
  const apiKey = e.apiKey || "none";
  if (e.protocol === "google") {
    return createGoogleGenerativeAI({ baseURL, apiKey }).embeddingModel(e.model) as EmbeddingModelV4;
  }
  return createOpenAICompatible({
    name: e.provider || "custom",
    baseURL,
    apiKey,
  }).embeddingModel(e.model) as EmbeddingModelV4;
}

/**
 * Builds whatever parts of the AI config are usable. Chat and embedding are
 * configured independently, so either may be missing. Pass `usage` whenever
 * the provider makes calls, so their tokens are counted.
 */
export function createProvider(settings: AiSettings, usage?: UsageContext): Provider | null {
  const provider: Provider = {};
  const chat = createChatModelWithFallbacks(settings, usage);
  if (chat) provider.chat = chat;
  const embedding = isEmbeddingConfigured(settings) ? resolveEmbeddingEndpoint(settings) : null;
  if (embedding) {
    provider.embedding = createEmbeddingModel(embedding, usage);
    provider.embeddingModelId = embedding.model;
  }
  return provider.chat || provider.embedding ? provider : null;
}

/** The text a bookmark is embedded from. */
export function embeddingInput(item: { name: string; category?: string; note?: string }): string {
  return [item.name, item.category, item.note].filter(Boolean).join("\n");
}

export async function embedText(
  provider: Provider,
  text: string,
): Promise<number[] | null> {
  if (!provider.embedding) return null;
  const { embedding } = await embed({
    model: provider.embedding,
    value: text,
  });
  return embedding;
}

export async function embedTexts(
  provider: Provider,
  texts: string[],
): Promise<number[][] | null> {
  if (!provider.embedding) return null;
  const { embeddings } = await embedMany({
    model: provider.embedding,
    values: texts,
  });
  return embeddings;
}

export function cosSim(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** A one-line error message with status, URL and response body when available. */
export function describeError(e: unknown): string {
  const err = RetryError.isInstance(e) ? e.lastError : e;
  if (APICallError.isInstance(err)) {
    const body = typeof err.responseBody === "string" ? err.responseBody.slice(0, 200) : "";
    return [err.statusCode, err.url, body || err.message].filter(Boolean).join(" · ");
  }
  return String(err instanceof Error ? err.message : err).slice(0, 300);
}
