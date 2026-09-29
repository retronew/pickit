// Chat side of the AI settings: the fallback list and the selected endpoint's fields.

import {
  AI_PROVIDERS,
  CHAT_PROTOCOLS,
  chatRequestUrls,
  CUSTOM_PROVIDER,
  findProvider,
  modelsListUrl,
} from "@pickit/shared";
import { Button } from "#components/ui/button";
import { PanelHeading, RequestPreview } from "./parts";
import { TestResult } from "./TestResult";
import { ReasoningField } from "./ReasoningField";
import { EndpointFields } from "./EndpointFields";
import { ModelField } from "./ModelField";
import { ChatEndpointList } from "./ChatEndpointList";
import type { ChatEndpointsState } from "./useAiSettings";
import { m } from "#lib/i18n";

export function ChatPanel({ chats, configured }: { chats: ChatEndpointsState; configured?: boolean }) {
  const e = chats.selected;
  const preset = findProvider(e.provider);
  return (
    <section className="space-y-4">
      <PanelHeading title={m.ai_chat_model()} configured={configured} />
      <ChatEndpointList
        endpoints={chats.list}
        isReady={chats.isReady}
        selectedId={e.id}
        onSelect={chats.select}
        onReorder={chats.reorder}
        onAdd={chats.add}
        onRemove={chats.remove}
      />
      {/* Keyed so the fields reset their local state when another endpoint is picked. */}
      <div key={e.id} className="space-y-4">
        <EndpointFields
          target="chat"
          endpoint={e}
          saved={chats.savedFor(e)}
          providers={AI_PROVIDERS}
          protocols={CHAT_PROTOCOLS.filter((p) => !preset || preset.chatProtocols.includes(p.value))}
          onProviderChange={(id) => {
            const next = findProvider(id);
            chats.patch({
              provider: id,
              baseUrl: next ? (next.customBaseUrl ? "" : next.baseUrl) : "",
              protocol: next?.chatProtocols[0] ?? "openai-chat",
              apiKey: "",
              model: "",
            });
            chats.resetModels();
          }}
          onChange={chats.patch}
        />
        <ModelField
          target="chat"
          value={e.model}
          placeholder={preset?.chatModelHint ?? m.ai_model_name()}
          state={chats.models}
          canFetch={!!e.baseUrl}
          fetchLabel={e.provider === CUSTOM_PROVIDER ? m.ai_detect_models() : m.ai_fetch_models()}
          onFetch={chats.fetchModels}
          onChange={(model) => chats.patch({ model })}
        />
        <ReasoningField value={e.reasoning} onChange={(reasoning) => chats.patch({ reasoning })} />
        <RequestPreview
          urls={[
            ...chatRequestUrls(e.protocol, e.baseUrl, e.model),
            { label: m.ai_models_list(), url: modelsListUrl(e.baseUrl) },
          ]}
        />
        <Button variant="outline" disabled={chats.test.running} onClick={chats.runTest}>
          {chats.test.running ? m.ai_testing() : m.ai_test_chat()}
        </Button>
        <TestResult state={chats.test} />
      </div>
    </section>
  );
}
