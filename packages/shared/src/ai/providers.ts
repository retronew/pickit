// Provider presets and wire protocols offered in the settings UI.

import type { ChatProtocol, EmbeddingProtocol, AiProviderPreset } from "./types";

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
