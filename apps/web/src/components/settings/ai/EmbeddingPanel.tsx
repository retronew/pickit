// Embedding side of the AI settings: a single endpoint, no fallback.

import { AI_PROVIDERS, EMBEDDING_PROTOCOLS, embeddingRequestUrls, findProvider } from "@pickit/shared";
import { Button } from "#components/ui/button";
import { PanelHeading, RequestPreview } from "./parts";
import { TestResult } from "./TestResult";
import { EndpointFields } from "./EndpointFields";
import { ModelField } from "./ModelField";
import type { SavedEndpoint } from "./shared";
import type { EmbeddingState } from "./useAiSettings";
import { m } from "#lib/i18n";

export function EmbeddingPanel({
  embedding,
  saved,
  configured,
}: {
  embedding: EmbeddingState;
  saved?: SavedEndpoint;
  configured?: boolean;
}) {
  const e = embedding.endpoint;
  const resolved = embedding.resolved;
  return (
    <section className="space-y-4">
      <PanelHeading title={m.ai_embedding_model()} configured={configured} />
      <EndpointFields
        target="embedding"
        endpoint={e}
        saved={saved}
        providers={AI_PROVIDERS.filter((p) => p.embeddingProtocol)}
        protocols={EMBEDDING_PROTOCOLS.filter((p) => {
          const preset = findProvider(e.provider);
          return !preset || preset.embeddingProtocol === p.value;
        })}
        onProviderChange={(id) => {
          const preset = findProvider(id);
          embedding.patch({
            provider: id,
            baseUrl: preset ? (preset.customBaseUrl ? "" : preset.baseUrl) : "",
            protocol: preset?.embeddingProtocol ?? "openai",
            apiKey: "",
            model: "",
          });
          embedding.resetModels();
        }}
        onChange={embedding.patch}
      />
      <ModelField
        target="embedding"
        value={e.model}
        placeholder={findProvider(e.provider)?.embeddingModelHint ?? m.ai_embedding_empty()}
        state={embedding.models}
        canFetch={!!e.baseUrl}
        fetchLabel={m.ai_fetch_models()}
        onFetch={embedding.fetchModels}
        onChange={(model) => embedding.patch({ model })}
      />
      <p className="text-muted-foreground text-xs">{m.ai_embedding_change_hint()}</p>
      <p className="text-muted-foreground text-xs">{m.ai_embedding_no_fallback()}</p>
      {resolved && <RequestPreview urls={embeddingRequestUrls(resolved.protocol, resolved.baseUrl, resolved.model)} />}
      <Button variant="outline" disabled={!e.model || embedding.test.running} onClick={embedding.runTest}>
        {embedding.test.running ? m.ai_testing() : m.ai_test_embedding()}
      </Button>
      <TestResult state={embedding.test} />
    </section>
  );
}
