// AI settings: independent chat and embedding endpoints.

import {
  AI_PROVIDERS,
  CHAT_PROTOCOLS,
  chatRequestUrls,
  CUSTOM_PROVIDER,
  EMBEDDING_PROTOCOLS,
  embeddingRequestUrls,
  findProvider,
  modelsListUrl,
} from "@pickit/shared";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { useAiSettings } from "./useAiSettings";
import { PanelHeading, RequestPreview, TestResult, AiSettingsSkeleton } from "./parts";
import { EndpointFields } from "./EndpointFields";
import { ModelField } from "./ModelField";
import { emptyModels } from "./shared";
import { m } from "#lib/i18n";

export function AiSettingsCard() {
  const {
    form,
    saved,
    models,
    tests,
    saveMessage,
    loadError,
    load,
    setModels,
    patchChat,
    patchEmbedding,
    fetchModels,
    runTest,
    save,
    embeddingEndpoint,
  } = useAiSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.ai_title()}</CardTitle>
        <CardDescription>
          {m.ai_description()}
        </CardDescription>
      </CardHeader>
      {!saved ? (
        loadError ? (
          <CardContent className="flex items-center gap-3 text-sm">
            <span className="text-destructive">{m.load_failed({ error: loadError })}</span>
            <Button variant="outline" size="sm" onClick={load}>
              {m.common_retry()}
            </Button>
          </CardContent>
        ) : (
          <AiSettingsSkeleton />
        )
      ) : (
        <>
          <CardContent className="grid animate-fade-in gap-8 lg:grid-cols-[1fr_auto_1fr]">
            <section className="space-y-4">
              <PanelHeading title={m.ai_chat_model()} configured={saved?.chatConfigured} />
              <EndpointFields
                target="chat"
                endpoint={form.chat}
                saved={saved?.chat}
                providers={AI_PROVIDERS}
                protocols={CHAT_PROTOCOLS.filter(
                  (p) =>
                    !findProvider(form.chat.provider) ||
                    findProvider(form.chat.provider)!.chatProtocols.includes(p.value),
                )}
                onProviderChange={(id) => {
                  const preset = findProvider(id);
                  patchChat({
                    provider: id,
                    baseUrl: preset ? (preset.customBaseUrl ? "" : preset.baseUrl) : "",
                    protocol: preset?.chatProtocols[0] ?? "openai-chat",
                    apiKey: "",
                    model: "",
                  });
                  setModels((prev) => ({ ...prev, chat: emptyModels }));
                }}
                onChange={patchChat}
              />
              <ModelField
                target="chat"
                value={form.chat.model}
                placeholder={findProvider(form.chat.provider)?.chatModelHint ?? m.ai_model_name()}
                state={models.chat}
                canFetch={!!form.chat.baseUrl}
                fetchLabel={form.chat.provider === CUSTOM_PROVIDER ? m.ai_detect_models() : m.ai_fetch_models()}
                onFetch={() => fetchModels("chat")}
                onChange={(model) => patchChat({ model })}
              />
              <RequestPreview
                urls={[
                  ...chatRequestUrls(form.chat.protocol, form.chat.baseUrl, form.chat.model),
                  { label: m.ai_models_list(), url: modelsListUrl(form.chat.baseUrl) },
                ]}
              />
              <TestResult state={tests.chat} />
            </section>

            {/* Horizontal when stacked, vertical between the two columns on lg. */}
            <div role="separator" className="h-px bg-border lg:h-auto lg:w-px" />

            <section className="space-y-4">
              <PanelHeading title={m.ai_embedding_model()} configured={saved?.embeddingConfigured} />
                <EndpointFields
                  target="embedding"
                  endpoint={form.embedding}
                  saved={saved?.embedding}
                  providers={AI_PROVIDERS.filter((p) => p.embeddingProtocol)}
                  protocols={EMBEDDING_PROTOCOLS.filter((p) => {
                    const preset = findProvider(form.embedding.provider);
                    return !preset || preset.embeddingProtocol === p.value;
                  })}
                  onProviderChange={(id) => {
                    const preset = findProvider(id);
                    patchEmbedding({
                      provider: id,
                      baseUrl: preset ? (preset.customBaseUrl ? "" : preset.baseUrl) : "",
                      protocol: preset?.embeddingProtocol ?? "openai",
                      apiKey: "",
                      model: "",
                    });
                    setModels((prev) => ({ ...prev, embedding: emptyModels }));
                  }}
                  onChange={patchEmbedding}
                />
              <ModelField
                target="embedding"
                value={form.embedding.model}
                placeholder={
                  findProvider(form.embedding.provider)
                    ?.embeddingModelHint ?? m.ai_embedding_empty()
                }
                state={models.embedding}
                canFetch={!!form.embedding.baseUrl}
                fetchLabel={m.ai_fetch_models()}
                onFetch={() => fetchModels("embedding")}
                onChange={(model) => patchEmbedding({ model })}
              />
              <p className="text-muted-foreground text-xs">
                {m.ai_embedding_change_hint()}
              </p>
              {embeddingEndpoint && (
                <RequestPreview
                  urls={embeddingRequestUrls(
                    embeddingEndpoint.protocol,
                    embeddingEndpoint.baseUrl,
                    embeddingEndpoint.model,
                  )}
                />
              )}
              <TestResult state={tests.embedding} />
            </section>
          </CardContent>
          <CardFooter className="flex animate-fade-in flex-wrap items-center gap-2">
            <Button size="lg" onClick={save}>
              {m.common_save()}
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={tests.chat.running}
              onClick={() => runTest("chat")}
            >
              {tests.chat.running ? m.ai_testing() : m.ai_test_chat()}
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={!form.embedding.model || tests.embedding.running}
              onClick={() => runTest("embedding")}
            >
              {tests.embedding.running ? m.ai_testing() : m.ai_test_embedding()}
            </Button>
            {saveMessage && <span className="text-muted-foreground text-sm">{saveMessage}</span>}
          </CardFooter>
        </>
      )}
    </Card>
  );
}
