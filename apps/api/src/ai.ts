import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel, EmbeddingModel } from "ai";
import { embed, embedMany } from "ai";
import {
  normalizeBaseUrl,
  resolveEmbeddingEndpoint,
  isChatConfigured,
  isEmbeddingConfigured,
  type AiSettings,
  type ChatEndpoint,
  type AiEndpoint,
  type EmbeddingProtocol,
} from "@pickit/shared";

export type { AiSettings };

export interface Provider {
  chat?: LanguageModel;
  embedding?: EmbeddingModel;
  embeddingModelId?: string;
}

export function createChatModel(e: ChatEndpoint): LanguageModel {
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

export function createEmbeddingModel(e: AiEndpoint<EmbeddingProtocol>): EmbeddingModel {
  const baseURL = normalizeBaseUrl(e.baseUrl);
  const apiKey = e.apiKey || "none";
  if (e.protocol === "google") {
    return createGoogleGenerativeAI({ baseURL, apiKey }).embeddingModel(e.model) as EmbeddingModel;
  }
  return createOpenAICompatible({
    name: e.provider || "custom",
    baseURL,
    apiKey,
  }).embeddingModel(e.model) as EmbeddingModel;
}

/**
 * Builds whatever parts of the AI config are usable. Chat and embedding are
 * configured independently, so either may be missing.
 */
export function createProvider(settings: AiSettings): Provider | null {
  const provider: Provider = {};
  if (isChatConfigured(settings)) provider.chat = createChatModel(settings.chat);
  const embedding = isEmbeddingConfigured(settings) ? resolveEmbeddingEndpoint(settings) : null;
  if (embedding) {
    provider.embedding = createEmbeddingModel(embedding);
    provider.embeddingModelId = embedding.model;
  }
  return provider.chat || provider.embedding ? provider : null;
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
