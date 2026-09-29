// AI settings: chat endpoints with fallbacks, and an independent embedding endpoint.

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { useAiSettings } from "./useAiSettings";
import { AiSettingsSkeleton } from "./parts";
import { ChatPanel } from "./ChatPanel";
import { EmbeddingPanel } from "./EmbeddingPanel";
import { m } from "#lib/i18n";

export function AiSettingsCard() {
  const { saved, saveMessage, loadError, load, save, chats, embedding } = useAiSettings();

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
            <ChatPanel chats={chats} configured={saved.chatConfigured} />
            {/* Horizontal when stacked, vertical between the two columns on lg. */}
            <div role="separator" className="h-px bg-border lg:h-auto lg:w-px" />
            <EmbeddingPanel embedding={embedding} saved={saved.embedding} configured={saved.embeddingConfigured} />
          </CardContent>
          <CardFooter className="flex animate-fade-in flex-wrap items-center gap-2">
            <Button size="lg" onClick={save}>
              {m.common_save()}
            </Button>
            {saveMessage && <span className="text-muted-foreground text-sm">{saveMessage}</span>}
          </CardFooter>
        </>
      )}
    </Card>
  );
}
