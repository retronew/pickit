import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { BotIcon, DatabaseIcon, ShieldCheckIcon, WandSparklesIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "#components/ui/card";
import { DataImportExportCard } from "#components/DataImportExportCard";
import { BookmarkletCard } from "#components/BookmarkletCard";
import { OrganizeCard } from "#components/OrganizeCard";
import { DuplicatesCard } from "#components/DuplicatesCard";
import { ApiTokenCard } from "#components/ApiTokenCard";
import { SharesCard } from "#components/SharesCard";
import { JobProgress, type JobState } from "#components/JobProgress";
import { Confirm } from "#components/Confirm";
import { Field, FieldLabel, FieldDescription } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { Button } from "#components/ui/button";
import { Separator } from "#components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "#components/ui/select";

function BuildInfo() {
  const commit = __APP_COMMIT__.slice(0, 7);
  const builtAt = new Date(__APP_BUILD_TIME__).toLocaleString("zh-CN", {
    hour12: false,
  });
  return (
    <p className="text-center text-xs text-muted-foreground tabular-nums">
      v{__APP_VERSION__}
      {commit && (
        <>
          {" · "}
          {__APP_REPO_URL__ ? (
            <a
              href={`${__APP_REPO_URL__}/commit/${__APP_COMMIT__}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline-offset-4 hover:text-foreground hover:underline"
            >
              {commit}
            </a>
          ) : (
            <span className="font-mono">{commit}</span>
          )}
        </>
      )}
      {" · "}
      <time dateTime={__APP_BUILD_TIME__}>部署于 {builtAt}</time>
    </p>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-sm font-semibold">{title}</h2>
        {description && (
          <span className="text-muted-foreground text-xs">{description}</span>
        )}
      </div>
      {children}
    </section>
  );
}

type AiApiMode = "chat" | "responses";

interface AiConfig {
  configured: boolean;
  baseUrl?: string;
  chatModel?: string;
  embeddingModel?: string;
  apiMode?: AiApiMode;
  apiKeyMasked?: string;
}

const API_MODES: { value: AiApiMode; label: string; hint: string }[] = [
  {
    value: "chat",
    label: "Chat Completions（推荐）",
    hint: "适合大多数 OpenAI 兼容服务（DeepSeek、Ollama 等），一般选这个。",
  },
  {
    value: "responses",
    label: "Responses API",
    hint: "上面的模式连不上时再试，部分新模型只支持这种接口。",
  },
];

const API_MODE_LABELS: Record<AiApiMode, string> = Object.fromEntries(
  API_MODES.map((m) => [m.value, m.label]),
) as Record<AiApiMode, string>;

export function SettingsPage() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [form, setForm] = useState({
    baseUrl: "",
    apiKey: "",
    chatModel: "",
    embeddingModel: "",
    apiMode: "chat" as AiApiMode,
  });
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [reembedJob, setReembedJob] = useState<JobState | null>(null);
  const [reembedError, setReembedError] = useState("");

  useEffect(() => {
    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((d: AiConfig) => {
        setConfig(d);
        setForm({
          baseUrl: d.baseUrl ?? "",
          apiKey: "",
          chatModel: d.chatModel ?? "",
          embeddingModel: d.embeddingModel ?? "",
          apiMode: d.apiMode ?? "chat",
        });
      });
  }, []);

  const fetchReembedStatus = () =>
    fetch("/api/items/reembed-status")
      .then((r) => r.json())
      .then((d: JobState) => setReembedJob(d));

  useEffect(() => {
    fetchReembedStatus();
  }, []);

  useEffect(() => {
    if (!reembedJob?.running) return;
    const timer = setInterval(fetchReembedStatus, 1200);
    return () => clearInterval(timer);
  }, [reembedJob?.running]);

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-lg font-semibold">设置</h1>

      <SettingsSection icon={BotIcon} title="AI 配置" description="用于自动整理、智能搜索和问答">
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-stretch">
        <Card>
          <CardHeader>
            <CardTitle>AI 服务（OpenAI 兼容）</CardTitle>
            {config?.configured && (
              <CardDescription>
                当前模型：{config.chatModel} · 密钥：{config.apiKeyMasked}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="baseUrl">Base URL</FieldLabel>
                <Input
                  id="baseUrl"
                  size="lg"
                  placeholder="https://api.deepseek.com/v1"
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="apiKey">
                  API 密钥 {config?.configured && "（留空表示不修改）"}
                </FieldLabel>
                <Input
                  id="apiKey"
                  size="lg"
                  type="password"
                  placeholder="sk-…"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="chatModel">对话模型</FieldLabel>
                <Input
                  id="chatModel"
                  size="lg"
                  placeholder="deepseek-chat"
                  value={form.chatModel}
                  onChange={(e) =>
                    setForm({ ...form, chatModel: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>接口模式</FieldLabel>
                <Select
                  value={form.apiMode}
                  onValueChange={(v) =>
                    setForm({ ...form, apiMode: v as AiApiMode })
                  }
                  items={API_MODE_LABELS}
                >
                  <SelectTrigger size="lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {API_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {API_MODES.find((m) => m.value === form.apiMode)?.hint}
                </FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="embeddingModel">
                向量模型（可选，用于智能搜索）
              </FieldLabel>
              <Input
                id="embeddingModel"
                size="lg"
                placeholder="text-embedding-3-small"
                value={form.embeddingModel}
                onChange={(e) =>
                  setForm({ ...form, embeddingModel: e.target.value })
                }
              />
            </Field>
          </CardContent>
          <CardFooter className="flex items-center gap-2">
            <Button
              size="lg"
              onClick={async () => {
                const res = await fetch("/api/settings/ai", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(form),
                });
                setMessage(res.ok ? "已保存" : "保存失败，请重试");
              }}
            >
              保存
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={testing}
              onClick={async () => {
                setTesting(true);
                setMessage("");
                const res = await fetch("/api/settings/ai/test", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(form),
                });
                const data = await res.json();
                setTesting(false);
                setMessage(
                  data.ok
                    ? `连接成功${data.embeddingOk === false ? "，但向量模型不可用" : ""}`
                    : `连接失败：${data.error}`,
                );
              }}
            >
              {testing ? "测试中…" : "测试连接"}
            </Button>
            {message && (
              <span className="text-muted-foreground text-sm">{message}</span>
            )}
          </CardFooter>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>向量索引重建</CardTitle>
            <CardDescription>
              换了向量模型后，需要为全部收藏重新生成索引。
            </CardDescription>
          </CardHeader>
          {reembedJob && reembedJob.total > 0 && (
            <CardContent>
              <JobProgress job={reembedJob} doneLabel="上次重建完成" />
            </CardContent>
          )}
          <CardFooter className="mt-auto flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              disabled={reembedJob?.running}
              onClick={async () => {
                setReembedError("");
                const res = await fetch("/api/items/reembed-all", {
                  method: "POST",
                });
                const data = await res.json();
                if (res.ok) {
                  await fetchReembedStatus();
                } else {
                  setReembedError(data.error ?? "启动失败，请稍后重试");
                }
              }}
            >
              {reembedJob?.running ? "重建中…" : "重建全部索引"}
            </Button>
            {!reembedJob?.running &&
              reembedJob &&
              reembedJob.failedIds.length > 0 && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={async () => {
                    setReembedError("");
                    const res = await fetch("/api/items/reembed-retry", {
                      method: "POST",
                    });
                    const data = await res.json();
                    if (res.ok) {
                      await fetchReembedStatus();
                    } else {
                      setReembedError(data.error ?? "重试失败，请稍后重试");
                    }
                  }}
                >
                  重试失败项
                </Button>
              )}
            {reembedError && (
              <span className="text-destructive text-sm">
                {reembedError}
              </span>
            )}
          </CardFooter>
        </Card>
      </div>
      </SettingsSection>

      <Separator />

      <SettingsSection icon={WandSparklesIcon} title="批量整理与去重">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <OrganizeCard />
          <DuplicatesCard />
        </div>
      </SettingsSection>

      <Separator />

      <SettingsSection icon={DatabaseIcon} title="数据导入导出">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <DataImportExportCard />
          <BookmarkletCard />
        </div>
      </SettingsSection>

      <Separator />

      <SettingsSection icon={ShieldCheckIcon} title="开发者与分享">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <ApiTokenCard />
          <SharesCard />
        </div>
      </SettingsSection>

      <BuildInfo />

      <Confirm />
    </div>
  );
}
