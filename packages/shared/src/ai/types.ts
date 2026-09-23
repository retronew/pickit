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
