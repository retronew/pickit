import type { ComponentType, ReactNode } from "react";
import { useSearchParams } from "react-router";
import { BotIcon, DatabaseIcon, ShieldCheckIcon, WandSparklesIcon } from "lucide-react";
import { DataImportExportCard } from "#components/settings/DataImportExportCard";
import { BookmarkletCard } from "#components/settings/BookmarkletCard";
import { OrganizeCard } from "#components/settings/OrganizeCard";
import { SummarizeCard } from "#components/settings/SummarizeCard";
import { DuplicatesCard } from "#components/settings/DuplicatesCard";
import { ApiTokenCard } from "#components/settings/ApiTokenCard";
import { AllowedEmailsCard } from "#components/settings/AllowedEmailsCard";
import { AiSettingsCard } from "#components/settings/ai/AiSettingsCard";
import { AiLanguageCard } from "#components/settings/ai/AiLanguageCard";
import { McpCard } from "#components/settings/McpCard";
import { ReembedCard } from "#components/settings/ReembedCard";
import { BuildInfo } from "#components/settings/BuildInfo";
import { BackupsCard } from "#components/settings/backups/BackupsCard";
import { Confirm } from "#components/Confirm";
import { ScrollFade } from "#components/ScrollFade";
import { Tabs, TabsList, TabsTab, TabsPanel } from "#components/ui/tabs";
import { m } from "#lib/i18n";

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
    label: m.settings_tab_ai(),
    icon: BotIcon,
    description: m.settings_tab_ai_description(),
    content: (
      <div className="space-y-6">
        <AiSettingsCard />
        <AiLanguageCard />
        <ReembedCard />
      </div>
    ),
  },
  {
    id: "organize",
    label: m.settings_tab_organize(),
    icon: WandSparklesIcon,
    description: m.settings_tab_organize_description(),
    content: (
      <div className={TWO_COLUMNS}>
        <OrganizeCard />
        <SummarizeCard />
        <DuplicatesCard />
      </div>
    ),
  },
  {
    id: "data",
    label: m.settings_tab_data(),
    icon: DatabaseIcon,
    description: m.settings_tab_data_description(),
    content: (
      <div className="space-y-6">
        <div className={TWO_COLUMNS}>
          <DataImportExportCard />
          <BookmarkletCard />
        </div>
        <BackupsCard />
      </div>
    ),
  },
  {
    id: "access",
    label: m.settings_tab_access(),
    icon: ShieldCheckIcon,
    description: m.settings_tab_access_description(),
    content: (
      <div className={TWO_COLUMNS}>
        <AllowedEmailsCard />
        <ApiTokenCard />
        <McpCard />
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
    <div className="compact-controls space-y-6">
      <h1 className="font-heading text-lg font-semibold">{m.nav_settings()}</h1>

      <Tabs
        value={tab}
        onValueChange={(value) => setParams({ tab: String(value) }, { replace: true })}
        className="min-w-0 gap-5"
      >
        <ScrollFade className="-mx-4 px-4">
          <TabsList>
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTab key={id} value={id} className="max-sm:text-sm">
                <Icon className="size-3.5 sm:size-4" />
                {label}
              </TabsTab>
            ))}
          </TabsList>
        </ScrollFade>
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
