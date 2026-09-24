import { PlusIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { CopyButton } from "#components/CopyButton";
import { ListSkeleton } from "#components/settings/skeletons";
import { WebhookDialog } from "#components/settings/webhooks/WebhookDialog";
import { WebhookRow } from "#components/settings/webhooks/WebhookRow";
import { useWebhooks } from "#hooks/useWebhooks";
import { m } from "#lib/i18n";

/** Settings card: outgoing webhooks and the signing secret of a new one. */
export function WebhooksCard() {
  const { webhooks, newSecret, dismissSecret, add, edit, test, remove, setEnabled } = useWebhooks();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook</CardTitle>
        <CardDescription>{m.webhooks_description()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {newSecret && (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <p className="font-medium text-sm">{m.webhook_secret_title()}</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs">{newSecret.secret}</code>
              <CopyButton text={newSecret.secret} toast={m.webhook_secret_copied()} aria-label={m.action_copy()} />
            </div>
            <p className="text-muted-foreground text-xs">{m.webhook_secret_hint()}</p>
            <Button variant="outline" size="sm" onClick={dismissSecret}>
              {m.webhook_secret_done()}
            </Button>
          </div>
        )}
        {webhooks === null ? (
          <ListSkeleton rows={2} />
        ) : webhooks.length === 0 ? (
          <p className="text-muted-foreground text-sm">{m.webhooks_none()}</p>
        ) : (
          <div className="-mx-2">
            {webhooks.map((w) => (
              <WebhookRow
                key={w.id}
                webhook={w}
                onToggle={(enabled) => setEnabled(w, enabled)}
                onEdit={() => edit(w)}
                onTest={() => test(w)}
                onDelete={() => remove(w)}
              />
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="lg" onClick={add}>
          <PlusIcon />
          {m.webhook_add_title()}
        </Button>
      </CardFooter>
      <WebhookDialog />
    </Card>
  );
}
