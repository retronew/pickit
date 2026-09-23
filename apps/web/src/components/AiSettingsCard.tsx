import { useEffect, useState } from "react";
import { toastError, toastSuccess } from "#lib/api";
import {
  AI_PROVIDERS,
  CHAT_PROTOCOLS,
  CUSTOM_PROVIDER,
  EMBEDDING_PROTOCOLS,
  baseUrlWarnings,
  chatRequestUrls,
  embeddingRequestUrls,
  emptyAiSettings,
  findProvider,
  modelsListUrl,
  normalizeBaseUrl,
  resolveEmbeddingEndpoint,
  type AiEndpoint,
  type AiSettings,
  type RequestUrl,
} from "@pickit/shared";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "#components/ui/card";
import { Field, FieldLabel, FieldDescription } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { Button } from "#components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "#components/ui/select";
import {
  Autocomplete,
  AutocompleteInput,
  AutocompletePopup,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
} from "#components/ui/autocomplete";

type Target = "chat" | "embedding";

interface ModelInfo {
  id: string;
  kind: "chat" | "embedding";
}

interface SavedEndpoint {
  provider: string;
  baseUrl: string;
  apiKeyMasked: string;
}

interface AiSettingsResponse {
  chat: AiSettings["chat"] & { apiKeyMasked: string };
  embedding: AiSettings["embedding"] & { apiKeyMasked: string };
  chatConfigured: boolean;
  embeddingConfigured: boolean;
}

interface ModelState {
  models: ModelInfo[];
  loading: boolean;
  message: string;
  error: boolean;
}

interface TestState {
  running: boolean;
  ok?: boolean;
  text?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  ...Object.fromEntries(AI_PROVIDERS.map((p) => [p.id, p.name])),
  [CUSTOM_PROVIDER]: "自定义",
};

function originOf(url: string): string | null {
  try {
    return new URL(normalizeBaseUrl(url)).origin;
  } catch {
    return null;
  }
}

/** Whether a request can carry a key: typed, reusable saved one, or not needed. */
function hasUsableKey(endpoint: AiEndpoint<string>, saved?: SavedEndpoint): boolean {
  if (endpoint.apiKey || endpoint.provider === CUSTOM_PROVIDER) return true;
  if (findProvider(endpoint.provider)?.keyOptional) return true;
  return (
    !!saved?.apiKeyMasked &&
    saved.provider === endpoint.provider &&
    originOf(saved.baseUrl) !== null &&
    originOf(saved.baseUrl) === originOf(endpoint.baseUrl)
  );
}

const emptyModels: ModelState = { models: [], loading: false, message: "", error: false };

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; data: T }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: (await res.json()) as T };
}

export function AiSettingsCard() {
  const [form, setForm] = useState<AiSettings>(emptyAiSettings);
  const [saved, setSaved] = useState<AiSettingsResponse | null>(null);
  const [models, setModels] = useState<Record<Target, ModelState>>({
    chat: emptyModels,
    embedding: emptyModels,
  });
  const [tests, setTests] = useState<Record<Target, TestState>>({
    chat: { running: false },
    embedding: { running: false },
  });
  const [saveMessage, setSaveMessage] = useState("");

  const load = () =>
    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((d: AiSettingsResponse) => {
        setSaved(d);
        const { apiKeyMasked: _c, ...chat } = d.chat;
        const { apiKeyMasked: _e, ...embedding } = d.embedding;
        setForm({ version: 2, chat, embedding });
      });

  useEffect(() => {
    load();
  }, []);


  const patchChat = (patch: Partial<AiSettings["chat"]>) =>
    setForm((f) => ({ ...f, chat: { ...f.chat, ...patch } }));
  const patchEmbedding = (patch: Partial<AiSettings["embedding"]>) =>
    setForm((f) => ({ ...f, embedding: { ...f.embedding, ...patch } }));

  const fetchModels = async (target: Target) => {
    if (!hasUsableKey(form[target], saved?.[target])) {
      setModels((m) => ({
        ...m,
        [target]: { models: [], loading: false, message: "请先填写 API 密钥，再获取模型列表", error: true },
      }));
      return;
    }
    setModels((m) => ({ ...m, [target]: { ...m[target], loading: true, message: "" } }));
    const { ok, data } = await postJson<{ baseUrl?: string; models?: ModelInfo[]; error?: string }>(
      "/api/settings/ai/models",
      { target, settings: form },
    );
    if (!ok || !data.models || !data.baseUrl) {
      setModels((m) => ({
        ...m,
        [target]: { models: [], loading: false, message: data.error ?? "获取失败", error: true },
      }));
      return;
    }
    // Model discovery may find the working route under /v1; adopt it.
    const current = normalizeBaseUrl(form[target].baseUrl);
    const adjusted = data.baseUrl !== current;
    if (adjusted) {
      if (target === "chat") patchChat({ baseUrl: data.baseUrl });
      else patchEmbedding({ baseUrl: data.baseUrl });
    }
    const wanted = data.models.filter((m) => m.kind === target).length;
    setModels((m) => ({
      ...m,
      [target]: {
        models: data.models!,
        loading: false,
        error: false,
        message:
          `找到 ${data.models!.length} 个模型` +
          (wanted ? `（其中 ${wanted} 个${target === "chat" ? "对话" : "向量"}模型）` : "") +
          (adjusted ? `，接口地址已自动改为 ${data.baseUrl}` : ""),
      },
    }));
  };

  const runTest = async (target: Target) => {
    setTests((t) => ({ ...t, [target]: { running: true } }));
    const { data } = await postJson<{
      ok: boolean;
      error?: string;
      reply?: string;
      dimensions?: number;
    }>("/api/settings/ai/test", { target, settings: form });
    setTests((t) => ({
      ...t,
      [target]: {
        running: false,
        ok: data.ok,
        text: data.ok
          ? target === "chat"
            ? `连接成功，模型回复：${data.reply || "（空）"}`
            : `连接成功，向量维度 ${data.dimensions}`
          : `连接失败：${data.error}`,
      },
    }));
  };

  const save = async () => {
    const { ok, data } = await postJson<{
      chatConfigured: boolean;
      embeddingConfigured: boolean;
    }>("/api/settings/ai", form);
    if (!ok) {
      setSaveMessage("保存失败，请重试");
      toastError("保存 AI 配置失败", undefined, { id: "ai-save" });
      return;
    }
    toastSuccess("AI 配置已保存", { id: "ai-save" });
    setSaveMessage(
      `已保存 · 对话模型${data.chatConfigured ? "可用" : "未配置"} · 向量模型${data.embeddingConfigured ? "可用" : "未配置"}`,
    );
    await load();
  };

  const embeddingEndpoint = resolveEmbeddingEndpoint(form);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 服务</CardTitle>
        <CardDescription>
          对话模型用于自动整理、摘要和问答；向量模型用于智能搜索和查重，两者可以使用不同的服务商。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-[1fr_auto_1fr]">
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
      <CardFooter className="flex flex-wrap items-center gap-2">
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
    </Card>
  );
}

function PanelHeading({ title, configured }: { title: string; configured?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="font-heading text-sm font-semibold">{title}</h3>
      {configured !== undefined && (
        <span
          className={
            configured
              ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400"
              : "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs"
          }
        >
          {configured ? "已启用" : "未配置"}
        </span>
      )}
    </div>
  );
}

function EndpointFields<P extends string>({
  target,
  endpoint,
  saved,
  providers,
  protocols,
  onProviderChange,
  onChange,
}: {
  target: Target;
  endpoint: AiEndpoint<P>;
  saved?: SavedEndpoint;
  providers: typeof AI_PROVIDERS;
  protocols: { value: P; label: string; hint: string }[];
  onProviderChange: (id: string) => void;
  onChange: (patch: Partial<AiEndpoint<P>>) => void;
}) {
  const preset = findProvider(endpoint.provider);
  const isCustom = endpoint.provider === CUSTOM_PROVIDER;
  const urlEditable = isCustom || !!preset?.customBaseUrl;
  const warnings = baseUrlWarnings(endpoint.baseUrl, urlEditable);
  // Mirrors the API: a saved key is reused only for the same provider and server.
  const keySaved =
    !!saved?.apiKeyMasked &&
    saved.provider === endpoint.provider &&
    originOf(saved.baseUrl) !== null &&
    originOf(saved.baseUrl) === originOf(endpoint.baseUrl);
  const providerItems = Object.fromEntries(
    [...providers.map((p) => p.id), CUSTOM_PROVIDER].map((id) => [id, PROVIDER_LABELS[id]]),
  );
  const protocolItems = Object.fromEntries(protocols.map((p) => [p.value, p.label]));
  const id = (name: string) => `${target}-${name}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>服务商</FieldLabel>
          <Select
            value={endpoint.provider || null}
            onValueChange={(v) => v && onProviderChange(v as string)}
            items={providerItems}
          >
            <SelectTrigger size="lg">
              <SelectValue placeholder="选择服务商" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(providerItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>接口模式</FieldLabel>
          <Select
            value={endpoint.protocol}
            onValueChange={(v) => v && onChange({ protocol: v as P } as Partial<AiEndpoint<P>>)}
            items={protocolItems}
            disabled={protocols.length <= 1}
          >
            <SelectTrigger size="lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {protocols.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            {protocols.find((p) => p.value === endpoint.protocol)?.hint}
          </FieldDescription>
        </Field>
      </div>
      {endpoint.provider && (
        <Field>
          <FieldLabel htmlFor={id("baseUrl")}>接口地址</FieldLabel>
          <Input
            id={id("baseUrl")}
            size="lg"
            className="font-mono"
            placeholder={preset?.baseUrl ?? "https://api.example.com/v1"}
            value={endpoint.baseUrl}
            readOnly={!urlEditable}
            onChange={(e) => onChange({ baseUrl: e.target.value } as Partial<AiEndpoint<P>>)}
          />
          <FieldDescription>
            {urlEditable
              ? "填到版本号为止，通常以 /v1 结尾，不要带 /chat/completions。不确定的话只填域名，点「检测并获取模型」会自动判断要不要加 /v1。"
              : "使用该服务商的官方地址，无需填写。需要使用其他地址时，请选择「自定义」。"}
          </FieldDescription>
          {warnings.map((w) => (
            <p key={w} className="text-xs text-amber-700 dark:text-amber-400">
              {w}
            </p>
          ))}
        </Field>
      )}
      {endpoint.provider && (
        <Field>
          <FieldLabel htmlFor={id("apiKey")}>
            API 密钥{preset?.keyOptional && "（可选）"}
          </FieldLabel>
          <Input
            id={id("apiKey")}
            size="lg"
            type="password"
            autoComplete="off"
            placeholder={keySaved ? `已保存 ${saved!.apiKeyMasked}，留空表示不修改` : "sk-…"}
            value={endpoint.apiKey}
            onChange={(e) => onChange({ apiKey: e.target.value } as Partial<AiEndpoint<P>>)}
          />
          {!keySaved && saved?.apiKeyMasked && (
            <FieldDescription>服务商或地址变了，之前保存的密钥不会被带过去，请重新填写。</FieldDescription>
          )}
        </Field>
      )}
    </div>
  );
}

function ModelField({
  target,
  value,
  placeholder,
  state,
  canFetch,
  fetchLabel,
  onFetch,
  onChange,
}: {
  target: Target;
  value: string;
  placeholder: string;
  state: ModelState;
  canFetch: boolean;
  fetchLabel: string;
  onFetch: () => void;
  onChange: (value: string) => void;
}) {
  const preferred = state.models.filter((m) => m.kind === target).map((m) => m.id);
  const items = preferred.length ? preferred : state.models.map((m) => m.id);
  // Show the full list when the popup opens; filter only once the user edits
  // the input. Otherwise a selected model filters the list down to itself.
  const [openedWith, setOpenedWith] = useState<string | null>(null);
  const query = value.trim().toLowerCase();
  const filteredItems =
    openedWith === value || !query ? items : items.filter((id) => id.toLowerCase().includes(query));
  return (
    <Field>
      <FieldLabel htmlFor={`${target}-model`}>模型</FieldLabel>
      <div className="flex gap-2">
        <Autocomplete
          items={items}
          filteredItems={filteredItems}
          value={value}
          onValueChange={(v) => onChange(v)}
          onOpenChange={(open) => setOpenedWith(open ? value : null)}
          openOnInputClick
        >
          <AutocompleteInput
            id={`${target}-model`}
            size="lg"
            className="font-mono"
            placeholder={placeholder}
            showTrigger={items.length > 0}
          />
          <AutocompletePopup>
            <AutocompleteEmpty>没有匹配的模型，可以直接输入</AutocompleteEmpty>
            <AutocompleteList>
              {(item: string) => (
                <AutocompleteItem key={item} value={item} className="font-mono">
                  {item}
                </AutocompleteItem>
              )}
            </AutocompleteList>
          </AutocompletePopup>
        </Autocomplete>
        <Button
          variant="outline"
          size="lg"
          className="shrink-0"
          disabled={!canFetch || state.loading}
          onClick={onFetch}
        >
          {state.loading ? "获取中…" : fetchLabel}
        </Button>
      </div>
      <FieldDescription>
        可以从获取到的列表里选，也可以直接手动输入模型名称。
      </FieldDescription>
      {state.message && (
        <p className={state.error ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
          {state.message}
        </p>
      )}
    </Field>
  );
}

function RequestPreview({ urls }: { urls: RequestUrl[] }) {
  return (
    <div className="bg-muted/50 space-y-1 rounded-lg px-3 py-2">
      <p className="text-muted-foreground text-xs">按当前设置，实际请求的地址：</p>
      {urls.map((u) => (
        <p key={u.label} className="flex gap-2 text-xs">
          <span className="text-muted-foreground w-14 shrink-0">{u.label}</span>
          <code className="min-w-0 break-all">{u.url}</code>
        </p>
      ))}
    </div>
  );
}

function TestResult({ state }: { state: TestState }) {
  if (!state.text) return null;
  return (
    <p
      className={
        state.ok
          ? "text-sm text-emerald-700 dark:text-emerald-400"
          : "text-destructive min-w-0 break-all text-sm"
      }
    >
      {state.text}
    </p>
  );
}
