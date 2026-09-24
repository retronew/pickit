import { PencilIcon, SendIcon, Trash2Icon } from "lucide-react";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { Switch } from "#components/ui/switch";
import { Hint } from "#components/Hint";
import { formatDateTime } from "#lib/format";
import { WEBHOOK_EVENT_LABELS, lastDeliveryOk, type Webhook } from "#lib/webhooks";
import { m } from "#lib/i18n";

interface Props {
  webhook: Webhook;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onTest: () => void;
  onDelete: () => void;
}

/** One webhook: URL, events, the latest delivery and actions. */
export function WebhookRow({ webhook: w, onToggle, onEdit, onTest, onDelete }: Props) {
  const ok = lastDeliveryOk(w);
  const last =
    w.lastAt === null
      ? m.webhook_never_sent()
      : ok
        ? m.webhook_last_ok({ date: formatDateTime(w.lastAt), status: w.lastStatus ?? 0 })
        : m.webhook_last_failed({ date: formatDateTime(w.lastAt), error: w.lastError ?? String(w.lastStatus) });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-2 py-2.5 hover:bg-accent/50 sm:flex-nowrap">
      <Switch checked={w.enabled} onCheckedChange={onToggle} aria-label={m.webhook_enabled()} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium text-sm">{w.url}</p>
        <div className="flex flex-wrap gap-1">
          {w.events.map((e) => (
            <Badge key={e} variant="outline" size="sm">
              {WEBHOOK_EVENT_LABELS[e]()}
            </Badge>
          ))}
        </div>
        <p className={ok === false ? "truncate text-destructive-foreground text-xs" : "truncate text-muted-foreground text-xs"}>
          {last}
        </p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <Hint content={m.webhook_test()}>
          <Button variant="ghost" size="icon-xs" aria-label={m.webhook_test()} onClick={onTest}>
            <SendIcon />
          </Button>
        </Hint>
        <Hint content={m.webhook_edit_title()}>
          <Button variant="ghost" size="icon-xs" aria-label={m.webhook_edit_title()} onClick={onEdit}>
            <PencilIcon />
          </Button>
        </Hint>
        <Hint content={m.action_delete()}>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={m.action_delete()}
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive-foreground"
          >
            <Trash2Icon />
          </Button>
        </Hint>
      </div>
    </div>
  );
}
