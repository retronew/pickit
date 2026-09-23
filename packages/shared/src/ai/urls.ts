// Base URL normalizing and the exact request URLs each protocol hits.

import type { ChatProtocol, EmbeddingProtocol } from "./types";

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

const EMBEDDING_ID = /embed|bge|\be5-|gte-|m3e|jina-clip|nomic|text-embedding/i;

/** Heuristic used to split a fetched model list into chat vs embedding models. */
export function isEmbeddingModelId(id: string): boolean {
  return EMBEDDING_ID.test(id);
}
