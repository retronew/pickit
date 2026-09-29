// Chat endpoints in fallback order: drag to reorder, click one to edit it.

import { PlusIcon, XIcon } from "lucide-react";
import type { ChatEndpoint } from "@pickit/shared";
import { SortableList } from "#components/SortableList";
import { Button } from "#components/ui/button";
import { cn } from "#lib/utils";
import { PROVIDER_LABELS } from "./shared";
import { m } from "#lib/i18n";

export function ChatEndpointList({
  endpoints,
  isReady,
  selectedId,
  onSelect,
  onReorder,
  onAdd,
  onRemove,
}: {
  endpoints: ChatEndpoint[];
  /** Complete, counting a saved key the form doesn't hold. */
  isReady: (e: ChatEndpoint) => boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onReorder: (list: ChatEndpoint[]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">{m.ai_chat_fallback_hint()}</p>
      <SortableList
        items={endpoints}
        getId={(e) => e.id}
        onChange={onReorder}
        renderItem={(e) => {
          const index = endpoints.indexOf(e);
          const ready = isReady(e);
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={e.id === selectedId}
                onClick={() => onSelect(e.id)}
                className={cn(
                  "-my-1 flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left",
                  e.id === selectedId ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <span className="text-muted-foreground w-10 shrink-0 text-xs">
                  {index === 0 ? m.ai_chat_primary() : m.ai_chat_fallback_n({ n: index })}
                </span>
                <span className="min-w-0 truncate">
                  {PROVIDER_LABELS[e.provider] ?? m.ai_chat_no_provider()}
                  {e.model && <span className="text-muted-foreground font-mono text-xs"> · {e.model}</span>}
                </span>
                {!ready && (
                  <span className="bg-muted text-muted-foreground ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs">
                    {m.ai_chat_incomplete()}
                  </span>
                )}
              </button>
              {endpoints.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={m.ai_chat_remove()}
                  onClick={() => onRemove(e.id)}
                >
                  <XIcon />
                </Button>
              )}
            </div>
          );
        }}
      />
      <Button variant="outline" size="sm" onClick={onAdd}>
        <PlusIcon />
        {m.ai_chat_add_fallback()}
      </Button>
    </div>
  );
}
