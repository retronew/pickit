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
        <CardTitle>AI 服务</CardTitle>
        <CardDescription>
          对话模型用于自动整理、摘要和问答；向量模型用于智能搜索和查重，两者可以使用不同的服务商。
        </CardDescription>
      </CardHeader>
      {!saved ? (
        loadError ? (
          <CardContent className="flex items-center gap-3 text-sm">
            <span className="text-destructive">加载失败：{loadError}</span>
            <Button variant="outline" size="sm" onClick={load}>
              重试
            </Button>
          </CardContent>
        ) : (
          <AiSettingsSkeleton />
        )
      ) : (
        <>
          <CardContent className="grid animate-fade-in gap-8 lg:grid-cols-[1fr_auto_1fr]">
            <section className="space-y-4">
              <PanelHeading title="对话模型" configured={saved?.chatConfigured} />
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
                  setModels((m) => ({ ...m, chat: emptyModels }));
                }}
                onChange={patchChat}
              />
              <ModelField
                target="chat"
                value={form.chat.model}
                placeholder={findProvider(form.chat.provider)?.chatModelHint ?? "模型名称"}
                state={models.chat}
                canFetch={!!form.chat.baseUrl}
                fetchLabel={form.chat.provider === CUSTOM_PROVIDER ? "检测并获取模型" : "获取模型列表"}
                onFetch={() => fetchModels("chat")}
                onChange={(model) => patchChat({ model })}
              />
              <RequestPreview
                urls={[
                  ...chatRequestUrls(form.chat.protocol, form.chat.baseUrl, form.chat.model),
                  { label: "模型列表", url: modelsListUrl(form.chat.baseUrl) },
                ]}
              />
              <TestResult state={tests.chat} />
            </section>

            {/* Horizontal when stacked, vertical between the two columns on lg. */}
            <div role="separator" className="h-px bg-border lg:h-auto lg:w-px" />

            <section className="space-y-4">
              <PanelHeading title="向量模型（可选）" configured={saved?.embeddingConfigured} />
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
                    setModels((m) => ({ ...m, embedding: emptyModels }));
                  }}
                  onChange={patchEmbedding}
                />
              <ModelField
                target="embedding"
                value={form.embedding.model}
                placeholder={
                  findProvider(form.embedding.provider)
                    ?.embeddingModelHint ?? "留空表示不使用向量功能"
                }
                state={models.embedding}
                canFetch={!!form.embedding.baseUrl}
                fetchLabel="获取模型列表"
                onFetch={() => fetchModels("embedding")}
                onChange={(model) => patchEmbedding({ model })}
              />
              <p className="text-muted-foreground text-xs">
                更换向量模型后，需要在下方「向量索引重建」里重新生成索引，否则旧向量无法和新模型比较。
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
              保存
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={tests.chat.running}
              onClick={() => runTest("chat")}
            >
              {tests.chat.running ? "测试中…" : "测试对话模型"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={!form.embedding.model || tests.embedding.running}
              onClick={() => runTest("embedding")}
            >
              {tests.embedding.running ? "测试中…" : "测试向量模型"}
            </Button>
            {saveMessage && <span className="text-muted-foreground text-sm">{saveMessage}</span>}
          </CardFooter>
        </>
      )}
    </Card>
  );
}
