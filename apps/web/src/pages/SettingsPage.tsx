import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { BotIcon, DatabaseIcon, ShieldCheckIcon, WandSparklesIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "#components/ui/card";
import { DataImportExportCard } from "#components/DataImportExportCard";
import { BookmarkletCard } from "#components/BookmarkletCard";
import { OrganizeCard } from "#components/OrganizeCard";
import { DuplicatesCard } from "#components/DuplicatesCard";
import { ApiTokenCard } from "#components/ApiTokenCard";
import { AiSettingsCard } from "#components/AiSettingsCard";
import { SharesCard } from "#components/SharesCard";
import { JobProgress, type JobState } from "#components/JobProgress";
import { Confirm } from "#components/Confirm";
import { Button } from "#components/ui/button";
import { Separator } from "#components/ui/separator";

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

export function SettingsPage() {
  const [reembedJob, setReembedJob] = useState<JobState | null>(null);
  const [reembedError, setReembedError] = useState("");

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
        <div className="space-y-6">
        <AiSettingsCard />

        <Card>
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
