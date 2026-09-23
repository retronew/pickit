// Types and helpers shared by the AI settings components.

import {
  AI_PROVIDERS,
  CUSTOM_PROVIDER,
  findProvider,
  normalizeBaseUrl,
  type AiEndpoint,
  type AiSettings,
} from "@pickit/shared";
import { m } from "#lib/i18n";

export type Target = "chat" | "embedding";

export interface ModelInfo {
  id: string;
  kind: "chat" | "embedding";
}

export interface SavedEndpoint {
  provider: string;
  baseUrl: string;
  apiKeyMasked: string;
}

export interface AiSettingsResponse {
  chat: AiSettings["chat"] & { apiKeyMasked: string };
  embedding: AiSettings["embedding"] & { apiKeyMasked: string };
  chatConfigured: boolean;
  embeddingConfigured: boolean;
}

export interface ModelState {
  models: ModelInfo[];
  loading: boolean;
  message: string;
  error: boolean;
}

export interface TestState {
  running: boolean;
  ok?: boolean;
  text?: string;
}

export const PROVIDER_LABELS: Record<string, string> = {
  ...Object.fromEntries(AI_PROVIDERS.map((p) => [p.id, p.name])),
  [CUSTOM_PROVIDER]: m.ai_custom(),
};

export function originOf(url: string): string | null {
  try {
    return new URL(normalizeBaseUrl(url)).origin;
  } catch {
    return null;
  }
}

/** Whether a request can carry a key: typed, reusable saved one, or not needed. */
export function hasUsableKey(endpoint: AiEndpoint<string>, saved?: SavedEndpoint): boolean {
  if (endpoint.apiKey || endpoint.provider === CUSTOM_PROVIDER) return true;
  if (findProvider(endpoint.provider)?.keyOptional) return true;
  return (
    !!saved?.apiKeyMasked &&
    saved.provider === endpoint.provider &&
    originOf(saved.baseUrl) !== null &&
    originOf(saved.baseUrl) === originOf(endpoint.baseUrl)
  );
}

export const emptyModels: ModelState = { models: [], loading: false, message: "", error: false };

export async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; data: T }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: (await res.json()) as T };
}
