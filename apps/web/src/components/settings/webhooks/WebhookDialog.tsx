import { useEffect, useState } from "react";
import { createCallable } from "react-call";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "#components/ui/dialog";
import { Button } from "#components/ui/button";
import { Checkbox } from "#components/ui/checkbox";
import { Field, FieldLabel } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABELS, type Webhook, type WebhookEvent } from "#lib/webhooks";
import { m } from "#lib/i18n";

export interface WebhookInput {
  url: string;
  events: WebhookEvent[];
}

/** Adds a webhook, or edits one when `webhook` is given. Resolves to the input or null. */
export const WebhookDialog = createCallable<{ webhook?: Webhook }, WebhookInput | null>(({ webhook, call }) => {
  const [entered, setEntered] = useState(false);
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [events, setEvents] = useState<WebhookEvent[]>(webhook?.events ?? ["item.created"]);
  const valid = /^https?:\/\/\S+$/.test(url.trim()) && events.length > 0;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function toggle(event: WebhookEvent, on: boolean) {
    setEvents((prev) => (on ? WEBHOOK_EVENTS.filter((e) => e === event || prev.includes(e)) : prev.filter((e) => e !== event)));
  }

  function submit() {
    if (valid) call.end({ url: url.trim(), events });
  }

  return (
    <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && call.end(null)}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{webhook ? m.webhook_edit_title() : m.webhook_add_title()}</DialogTitle>
          <DialogDescription>{m.webhook_dialog_hint()}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Field>
              <FieldLabel htmlFor="webhook-url">{m.webhook_url_label()}</FieldLabel>
              <Input
                id="webhook-url"
                type="url"
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/pickit-hook"
              />
            </Field>
            <fieldset className="space-y-2">
              <legend className="mb-2 font-medium text-sm">{m.webhook_events_label()}</legend>
              {WEBHOOK_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={events.includes(event)} onCheckedChange={(v) => toggle(event, !!v)} />
                  <span>{WEBHOOK_EVENT_LABELS[event]()}</span>
                  <code className="text-muted-foreground text-xs">{event}</code>
                </label>
              ))}
            </fieldset>
          </form>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => call.end(null)}>
            {m.common_cancel()}
          </Button>
          <Button onClick={submit} disabled={!valid}>
            {m.common_save()}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}, 200);
