// Endpoint, settings and provider preset types.

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

/**
 * How much the chat model thinks before answering (AI SDK's `reasoning` call
 * option, mapped by each provider). "provider-default" leaves it to the model.
 */
export type ReasoningLevel = "provider-default" | "none" | "low" | "medium" | "high";

export type ChatEndpoint = AiEndpoint<ChatProtocol> & {
  /** Stable across reordering, so a saved key follows its endpoint. */
  id: string;
  reasoning: ReasoningLevel;
};
/** Configured independently of the chat endpoint, so the two can use different providers. */
export type EmbeddingEndpoint = AiEndpoint<EmbeddingProtocol>;

export interface AiSettings {
  version: 2;
  chat: ChatEndpoint;
  /**
   * Tried in order when the chat endpoint (or the previous fallback) fails.
   * Embeddings have no fallback: vectors from different models don't mix.
   */
  chatFallbacks: ChatEndpoint[];
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

/** What a successful chat test measured. */
export interface ChatTestReport {
  reply: string;
  /** The model id the provider says answered, which may differ from the configured one. */
  modelId: string;
  reasoning: ReasoningLevel;
  /** From sending the request to the last token. */
  durationMs: number;
  /** Until the first token (thinking or answer); null when nothing streamed. */
  firstTokenMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  /** Thinking tokens, when the provider reports them. */
  reasoningTokens: number | null;
  /** The start of the model's visible thinking, when it returns any. */
  reasoningText: string;
  finishReason: string;
}
