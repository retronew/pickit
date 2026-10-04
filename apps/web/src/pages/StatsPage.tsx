import type { ComponentType, ReactNode } from "react";
import { useSearchParams } from "react-router";
import { BookmarkIcon, BotIcon } from "lucide-react";
import { CollectionStats } from "#components/stats/CollectionStats";
import { AiUsageStats } from "#components/stats/ai/AiUsageStats";
import { Confirm } from "#components/Confirm";
import { ScrollFade } from "#components/ScrollFade";
import { Tabs, TabsList, TabsTab, TabsPanel } from "#components/ui/tabs";
import { m } from "#lib/i18n";

interface StatsTab {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  content: ReactNode;
}

const TABS: StatsTab[] = [
  { id: "collection", label: m.stats_tab_collection(), icon: BookmarkIcon, content: <CollectionStats /> },
  { id: "ai", label: m.stats_tab_ai(), icon: BotIcon, content: <AiUsageStats /> },
];

export function StatsPage() {
  // The tab lives in the URL (?tab=ai) so it survives reloads and can be linked.
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = TABS.some((t) => t.id === requested) ? requested! : TABS[0].id;

  return (
    <div className="space-y-6">
      <h1 className="font-heading font-semibold text-lg">{m.nav_stats()}</h1>

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
          <TabsPanel key={t.id} value={t.id}>
            {t.content}
          </TabsPanel>
        ))}
      </Tabs>
      <Confirm />
    </div>
  );
}
