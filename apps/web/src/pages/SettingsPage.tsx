import type { ComponentType } from "react";
import { BotIcon, DatabaseIcon, ShieldCheckIcon, WandSparklesIcon } from "lucide-react";
import { DataImportExportCard } from "#components/DataImportExportCard";
import { BookmarkletCard } from "#components/BookmarkletCard";
import { OrganizeCard } from "#components/OrganizeCard";
import { DuplicatesCard } from "#components/DuplicatesCard";
import { ApiTokenCard } from "#components/ApiTokenCard";
import { AllowedEmailsCard } from "#components/AllowedEmailsCard";
import { AiSettingsCard } from "#components/AiSettingsCard";
import { SharesCard } from "#components/SharesCard";
import { ReembedCard } from "#components/ReembedCard";
import { Confirm } from "#components/Confirm";
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
  return (
    <div className="space-y-8">
      <h1 className="font-heading text-lg font-semibold">设置</h1>

      <SettingsSection icon={BotIcon} title="AI 配置" description="用于自动整理、智能搜索和问答">
        <div className="space-y-6">
          <AiSettingsCard />
          <ReembedCard />
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

      <SettingsSection icon={ShieldCheckIcon} title="访问与分享">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <AllowedEmailsCard />
          <ApiTokenCard />
          <SharesCard />
        </div>
      </SettingsSection>

      <BuildInfo />

      <Confirm />
    </div>
  );
}
