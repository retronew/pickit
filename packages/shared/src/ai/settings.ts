// Stored AI settings: defaults, legacy upgrade and readiness checks.

import type { ChatEndpoint, EmbeddingEndpoint, AiSettings } from "./types";
import { CUSTOM_PROVIDER, findProvider } from "./providers";
import { embeddingProtocolFor } from "./urls";

/** The embedding endpoint, or null when no embedding model is set. */
export function resolveEmbeddingEndpoint(settings: AiSettings): EmbeddingEndpoint | null {
  return settings.embedding.model ? settings.embedding : null;
}

export function emptyAiSettings(): AiSettings {
  return {
    version: 2,
    chat: { provider: "", baseUrl: "", apiKey: "", protocol: "openai-chat", model: "" },
    embedding: {
      provider: "",
      baseUrl: "",
      apiKey: "",
      protocol: "openai",
      model: "",
    },
  };
}

interface LegacyAiSettings {
  baseUrl?: string;
  apiKey?: string;
  chatModel?: string;
  embeddingModel?: string;
  apiMode?: "chat" | "responses";
}

/** Upgrades the single-endpoint config stored before v2. */
export function upgradeAiSettings(raw: unknown): AiSettings {
  if (raw && typeof raw === "object" && (raw as { version?: number }).version === 2) {
    const s = raw as AiSettings & { embedding?: { inheritChat?: boolean } };
    const empty = emptyAiSettings();
    const chat = { ...empty.chat, ...s.chat };
    const { inheritChat, ...embedding } = { ...empty.embedding, ...s.embedding };
    // Earlier v2 configs could reuse the chat provider for embeddings; copy it
    // over so the two endpoints are independent from now on.
    // Anthropic has no embeddings API, so there is nothing to copy from it.
    if (inheritChat && embeddingProtocolFor(chat.protocol)) {
      Object.assign(embedding, embeddingFromChat(chat));
    }
    return { version: 2, chat, embedding };
  }
  const legacy = (raw ?? {}) as LegacyAiSettings;
  const settings = emptyAiSettings();
  if (legacy.baseUrl || legacy.chatModel) {
    settings.chat = {
      provider: CUSTOM_PROVIDER,
      baseUrl: legacy.baseUrl ?? "",
      apiKey: legacy.apiKey ?? "",
      protocol: legacy.apiMode === "responses" ? "openai-responses" : "openai-chat",
      model: legacy.chatModel ?? "",
    };
    if (legacy.embeddingModel) {
      settings.embedding = {
        ...embeddingFromChat(settings.chat),
        model: legacy.embeddingModel,
      };
    }
  }
  return settings;
}

function embeddingFromChat(chat: ChatEndpoint): Omit<EmbeddingEndpoint, "model"> {
  return {
    provider: chat.provider,
    baseUrl: chat.baseUrl,
    apiKey: chat.apiKey,
    protocol: embeddingProtocolFor(chat.protocol) ?? "openai",
  };
}

export function isChatConfigured(s: AiSettings): boolean {
  const preset = findProvider(s.chat.provider);
  return !!(s.chat.baseUrl && s.chat.model && (s.chat.apiKey || preset?.keyOptional));
}

export function isEmbeddingConfigured(s: AiSettings): boolean {
  const e = resolveEmbeddingEndpoint(s);
  if (!e) return false;
  const preset = findProvider(e.provider);
  return !!(e.baseUrl && e.model && (e.apiKey || preset?.keyOptional));
}
