import type { ComponentType, ReactNode } from "react";
import { useSearchParams } from "react-router";
import { BotIcon, DatabaseIcon, ShieldCheckIcon, WandSparklesIcon } from "lucide-react";
import { DataImportExportCard } from "#components/settings/DataImportExportCard";
import { BookmarkletCard } from "#components/settings/BookmarkletCard";
import { OrganizeCard } from "#components/settings/OrganizeCard";
import { DuplicatesCard } from "#components/settings/DuplicatesCard";
import { ApiTokenCard } from "#components/settings/ApiTokenCard";
import { AllowedEmailsCard } from "#components/settings/AllowedEmailsCard";
import { AiSettingsCard } from "#components/settings/ai/AiSettingsCard";
import { SharesCard } from "#components/settings/SharesCard";
import { ReembedCard } from "#components/settings/ReembedCard";
import { BuildInfo } from "#components/settings/BuildInfo";
import { Confirm } from "#components/Confirm";
import { Tabs, TabsList, TabsTab, TabsPanel } from "#components/ui/tabs";

interface SettingsTab {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  content: ReactNode;
}

const TWO_COLUMNS = "grid gap-6 lg:grid-cols-2 lg:items-start";

const TABS: SettingsTab[] = [
  {
    id: "ai",
    label: "AI 配置",
    icon: BotIcon,
    description: "用于自动整理、智能搜索和问答",
    content: (
      <div className="space-y-6">
        <AiSettingsCard />
        <ReembedCard />
      </div>
    ),
  },
  {
    id: "organize",
    label: "整理与去重",
    icon: WandSparklesIcon,
    description: "用 AI 批量整理分类和标签，找出并合并重复的收藏",
    content: (
      <div className={TWO_COLUMNS}>
        <OrganizeCard />
        <DuplicatesCard />
      </div>
    ),
  },
  {
    id: "data",
    label: "导入导出",
    icon: DatabaseIcon,
    description: "导入、导出收藏，以及一键收藏的书签工具",
    content: (
      <div className={TWO_COLUMNS}>
        <DataImportExportCard />
        <BookmarkletCard />
      </div>
    ),
  },
  {
    id: "access",
    label: "访问与分享",
    icon: ShieldCheckIcon,
    description: "谁能登录、脚本访问用的 API Token 和公开分享链接",
    content: (
      <div className={TWO_COLUMNS}>
        <AllowedEmailsCard />
        <ApiTokenCard />
        <SharesCard />
      </div>
    ),
  },
];

export function SettingsPage() {
  // The tab lives in the URL (?tab=access) so it survives reloads and can be linked.
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = TABS.some((t) => t.id === requested) ? requested! : TABS[0].id;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-lg font-semibold">设置</h1>

      <Tabs
        value={tab}
        onValueChange={(value) => setParams({ tab: String(value) }, { replace: true })}
        className="gap-5"
      >
        <div className="-mx-4 overflow-x-auto px-4">
          <TabsList>
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTab key={id} value={id}>
                <Icon className="size-4" />
                {label}
              </TabsTab>
            ))}
          </TabsList>
        </div>
        {TABS.map((t) => (
          <TabsPanel key={t.id} value={t.id} className="space-y-4">
            <p className="text-muted-foreground text-sm">{t.description}</p>
            {t.content}
          </TabsPanel>
        ))}
      </Tabs>

      <BuildInfo />
      <Confirm />
    </div>
  );
}
