import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel, EmbeddingModel } from "ai";
import { embed, embedMany } from "ai";

export type AiApiMode = "chat" | "responses";

export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  embeddingModel?: string;
  apiMode?: AiApiMode;
}

export interface Provider {
  chat: LanguageModel;
  embedding?: EmbeddingModel;
  embeddingModelId?: string;
}

export function createProvider(settings: AiSettings): Provider | null {
  if (!settings.baseUrl || !settings.apiKey || !settings.chatModel) return null;
  const compatible = createOpenAICompatible({
    name: "custom",
    baseURL: settings.baseUrl,
    apiKey: settings.apiKey,
  });

  let chat: LanguageModel;
  if (settings.apiMode === "responses") {
    // 官方 openai provider 才支持 /responses 端点；chat/completions 走通用兼容 provider
    const openai = createOpenAI({
      baseURL: settings.baseUrl,
      apiKey: settings.apiKey,
    });
    chat = openai.responses(settings.chatModel);
  } else {
    chat = compatible.chatModel(settings.chatModel);
  }

  return {
    chat,
    embedding: settings.embeddingModel
      ? (compatible.textEmbeddingModel(settings.embeddingModel) as EmbeddingModel)
      : undefined,
    embeddingModelId: settings.embeddingModel || undefined,
  };
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
