// AI provider catalog and URL rules shared by the API (to build real requests)
// and the web settings page (to preview them). Keep both sides on this module
// so the previewed URL is always the one actually requested.

/** Wire protocol used for chat / text generation. */
export type ChatProtocol = "openai-chat" | "openai-responses" | "anthropic" | "google";
/** Wire protocol used for embeddings. */
export type EmbeddingProtocol = "openai" | "google";

export interface AiEndpoint<P extends string> {
  /** Preset id from AI_PROVIDERS, or "custom". */
  provider: string;
  baseUrl: string;
  apiKey: string;
  protocol: P;
  model: string;
}

export type ChatEndpoint = AiEndpoint<ChatProtocol>;
/** Configured independently of the chat endpoint, so the two can use different providers. */
export type EmbeddingEndpoint = AiEndpoint<EmbeddingProtocol>;

export interface AiSettings {
  version: 2;
  chat: ChatEndpoint;
  embedding: EmbeddingEndpoint;
}

export interface AiProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  /** Supported chat protocols, the first one is the default. */
  chatProtocols: ChatProtocol[];
  /** Embedding protocol, or null when the provider has no embeddings API. */
  embeddingProtocol: EmbeddingProtocol | null;
  /** Shown as input placeholders; the real list comes from "fetch models". */
  chatModelHint: string;
  embeddingModelHint?: string;
  keyOptional?: boolean;
  /** The preset URL is only an example; the user must enter their own host. */
  customBaseUrl?: boolean;
  /** Whether GET {baseUrl}/models works, so the model list can be fetched. */
  listModels: boolean;
}

export const CUSTOM_PROVIDER = "custom";

// Mirrors the providers documented by the AI SDK (official + OpenAI-compatible
// community ones). Only openai / anthropic / google need dedicated SDK
// packages; everything else speaks the OpenAI-compatible wire format.
export const AI_PROVIDERS: AiProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    chatProtocols: ["openai-responses", "openai-chat"],
    embeddingProtocol: "openai",
    chatModelHint: "gpt-4.1-mini",
    embeddingModelHint: "text-embedding-3-small",
    listModels: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    chatProtocols: ["anthropic"],
    embeddingProtocol: null,
    chatModelHint: "claude-haiku-4-5",
    listModels: true,
  },
  {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    chatProtocols: ["google"],
    embeddingProtocol: "google",
    chatModelHint: "gemini-2.5-flash",
    embeddingModelHint: "gemini-embedding-001",
    listModels: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: null,
    chatModelHint: "deepseek-chat",
    listModels: true,
  },
  {
    id: "alibaba",
    name: "阿里云百炼 (Qwen)",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: "openai",
    chatModelHint: "qwen-plus",
    embeddingModelHint: "text-embedding-v4",
    listModels: true,
  },
  {
    id: "moonshotai",
    name: "Moonshot (Kimi)",
    baseUrl: "https://api.moonshot.cn/v1",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: null,
    chatModelHint: "kimi-latest",
    listModels: true,
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: "openai",
    chatModelHint: "glm-4-flash",
    embeddingModelHint: "embedding-3",
    listModels: false,
  },
  {
    id: "siliconflow",
    name: "SiliconFlow 硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: "openai",
    chatModelHint: "deepseek-ai/DeepSeek-V3",
    embeddingModelHint: "BAAI/bge-m3",
    listModels: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: null,
    chatModelHint: "openai/gpt-4.1-mini",
    listModels: true,
  },
  {
    id: "xai",
    name: "xAI Grok",
    baseUrl: "https://api.x.ai/v1",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: null,
    chatModelHint: "grok-3-mini",
    listModels: true,
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: "openai",
    chatModelHint: "mistral-small-latest",
    embeddingModelHint: "mistral-embed",
    listModels: true,
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: null,
    chatModelHint: "llama-3.3-70b-versatile",
    listModels: true,
  },
  {
    id: "togetherai",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: "openai",
    chatModelHint: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    embeddingModelHint: "BAAI/bge-base-en-v1.5",
    listModels: true,
  },
  {
    id: "fireworks",
    name: "Fireworks",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: "openai",
    chatModelHint: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    embeddingModelHint: "nomic-ai/nomic-embed-text-v1.5",
    listModels: true,
  },
  {
    id: "deepinfra",
    name: "DeepInfra",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: "openai",
    chatModelHint: "meta-llama/Llama-3.3-70B-Instruct",
    embeddingModelHint: "BAAI/bge-m3",
    listModels: true,
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: null,
    chatModelHint: "llama-3.3-70b",
    listModels: true,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    baseUrl: "https://api.perplexity.ai",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: null,
    chatModelHint: "sonar",
    listModels: false,
  },
  {
    id: "ollama",
    name: "Ollama（需公网可访问）",
    baseUrl: "https://your-ollama-host/v1",
    chatProtocols: ["openai-chat"],
    embeddingProtocol: "openai",
    chatModelHint: "qwen3:8b",
    embeddingModelHint: "nomic-embed-text",
    keyOptional: true,
    customBaseUrl: true,
    listModels: true,
  },
];

export const CHAT_PROTOCOLS: { value: ChatProtocol; label: string; hint: string }[] = [
  {
    value: "openai-chat",
    label: "OpenAI Chat Completions",
    hint: "绝大多数 OpenAI 兼容服务都用这个，不确定就选它。",
  },
  {
    value: "openai-responses",
    label: "OpenAI Responses",
    hint: "OpenAI 官方的新接口，部分新模型只支持这种。",
  },
  {
    value: "anthropic",
    label: "Anthropic Messages",
    hint: "Claude 原生接口，也适用于兼容 Anthropic 格式的自定义服务。",
  },
  {
    value: "google",
    label: "Google Gemini",
    hint: "Gemini 原生接口（generateContent）。",
  },
];

export const EMBEDDING_PROTOCOLS: { value: EmbeddingProtocol; label: string; hint: string }[] = [
  {
    value: "openai",
    label: "OpenAI Embeddings",
    hint: "OpenAI 兼容的 /embeddings 接口，绝大多数服务都用这个。",
  },
  {
    value: "google",
    label: "Google Gemini",
    hint: "Gemini 原生 embedContent 接口。",
  },
];

export function findProvider(id: string): AiProviderPreset | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

// Paths people often paste together with the base URL by mistake.
const ENDPOINT_SUFFIX =
  /\/(chat\/completions|completions|responses|embeddings|messages|models)\/?$/i;

/**
 * Cleans up a user-entered base URL: trims whitespace, drops trailing slashes
 * and a mistakenly pasted endpoint path such as /chat/completions.
 */
export function normalizeBaseUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, "");
  while (ENDPOINT_SUFFIX.test(url)) url = url.replace(ENDPOINT_SUFFIX, "");
  // The Anthropic SDK appends /v1 to the bare host; mirror it for the preview.
  if (/^https:\/\/api\.anthropic\.com$/i.test(url)) url += "/v1";
  return url;
}

function hasVersionSegment(url: string): boolean {
  try {
    return /\/v\d+(beta\d*|alpha\d*)?(\/|$)/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Human-readable problems with a base URL, shown under the input. */
export function baseUrlWarnings(input: string, isCustom: boolean): string[] {
  const warnings: string[] = [];
  const trimmed = input.trim();
  if (!trimmed) return warnings;
  if (!/^https?:\/\//i.test(trimmed)) {
    warnings.push("地址需要以 http:// 或 https:// 开头。");
    return warnings;
  }
  const normalized = normalizeBaseUrl(trimmed);
  if (normalized !== trimmed.replace(/\/+$/, "")) {
    warnings.push(`已忽略末尾的接口路径，实际使用 ${normalized}`);
  }
  if (isCustom && !hasVersionSegment(normalized)) {
    warnings.push(
      "地址里没有 /v1 这类版本号。大多数 OpenAI 兼容服务需要以 /v1 结尾，可以点「检测并获取模型」自动判断。",
    );
  }
  return warnings;
}

export interface RequestUrl {
  label: string;
  url: string;
}

function modelPath(model: string): string {
  return encodeURIComponent(model || "{model}");
}

/** The URLs the API will actually call for a chat endpoint. */
export function chatRequestUrls(protocol: ChatProtocol, baseUrl: string, model: string): RequestUrl[] {
  const b = normalizeBaseUrl(baseUrl) || "{baseUrl}";
  switch (protocol) {
    case "openai-chat":
      return [{ label: "对话", url: `POST ${b}/chat/completions` }];
    case "openai-responses":
      return [{ label: "对话", url: `POST ${b}/responses` }];
    case "anthropic":
      return [{ label: "对话", url: `POST ${b}/messages` }];
    case "google":
      return [
        { label: "对话", url: `POST ${b}/models/${modelPath(model)}:generateContent` },
        { label: "流式对话", url: `POST ${b}/models/${modelPath(model)}:streamGenerateContent?alt=sse` },
      ];
  }
}

/** The URLs the API will actually call for an embedding endpoint. */
export function embeddingRequestUrls(
  protocol: EmbeddingProtocol,
  baseUrl: string,
  model: string,
): RequestUrl[] {
  const b = normalizeBaseUrl(baseUrl) || "{baseUrl}";
  if (protocol === "google") {
    return [
      { label: "向量", url: `POST ${b}/models/${modelPath(model)}:embedContent` },
      { label: "批量向量", url: `POST ${b}/models/${modelPath(model)}:batchEmbedContents` },
    ];
  }
  return [{ label: "向量", url: `POST ${b}/embeddings` }];
}

export function modelsListUrl(baseUrl: string): string {
  return `GET ${normalizeBaseUrl(baseUrl) || "{baseUrl}"}/models`;
}

/** The embedding protocol matching a chat protocol, or null when it has none (Anthropic). */
export function embeddingProtocolFor(chat: ChatProtocol): EmbeddingProtocol | null {
  if (chat === "google") return "google";
  if (chat === "anthropic") return null;
  return "openai";
}

/** The embedding endpoint, or null when no embedding model is set. */
export function resolveEmbeddingEndpoint(settings: AiSettings): EmbeddingEndpoint | null {
  return settings.embedding.model ? settings.embedding : null;
}

const EMBEDDING_ID = /embed|bge|\be5-|gte-|m3e|jina-clip|nomic|text-embedding/i;

/** Heuristic used to split a fetched model list into chat vs embedding models. */
export function isEmbeddingModelId(id: string): boolean {
  return EMBEDDING_ID.test(id);
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
