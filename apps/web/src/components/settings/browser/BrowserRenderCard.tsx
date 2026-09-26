import { useEffect, useState } from "react";
import {
  BROWSER_DEFAULT_LIMIT,
  BROWSER_MAX_LIMIT_MINUTES,
  BROWSER_PLAN_QUOTA,
  clampBrowserLimit,
  type BrowserRenderPlan,
  type BrowserRenderSettings,
} from "@pickit/shared";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Field, FieldLabel } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { RadioGroup, Radio } from "#components/ui/radio-group";
import { Switch } from "#components/ui/switch";
import { TextSkeleton } from "#components/settings/skeletons";
import { BrowserUsage } from "#components/settings/browser/BrowserUsage";
import { BrowserTokenForm } from "#components/settings/browser/BrowserTokenForm";
import { useBrowserRender } from "#hooks/useBrowserRender";
import { m } from "#lib/i18n";

const PLAN_LABELS: Record<BrowserRenderPlan, () => string> = {
  free: m.browser_render_plan_free,
  paid: m.browser_render_plan_paid,
};

/** Cloudflare Browser Rendering for page text: plan, usage limit, account and token. */
export function BrowserRenderCard() {
  const { info, saving, savingToken, save, saveToken, removeToken } = useBrowserRender();
  const [draft, setDraft] = useState<BrowserRenderSettings | null>(null);

  useEffect(() => {
    if (info) setDraft({ enabled: info.enabled, plan: info.plan, accountId: info.accountId, limitMinutes: info.limitMinutes });
  }, [info]);

  const dirty =
    !!info &&
    !!draft &&
    (draft.plan !== info.plan || draft.accountId !== info.accountId || draft.limitMinutes !== info.limitMinutes);
  const maxLimit = draft?.plan === "free" ? BROWSER_PLAN_QUOTA.free.minutes : BROWSER_MAX_LIMIT_MINUTES;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.browser_render_title()}</CardTitle>
        <CardDescription>{m.browser_render_description()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!info || !draft ? (
          <TextSkeleton className="my-0.5 w-48" />
        ) : (
          <div className="animate-fade-in space-y-5">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{m.browser_render_enabled()}</span>
              <Switch
                checked={info.enabled}
                disabled={!info.accountId || !info.tokenMasked}
                onCheckedChange={(enabled) =>
                  save({ enabled, plan: info.plan, accountId: info.accountId, limitMinutes: info.limitMinutes })
                }
              />
            </label>
            {(!info.accountId || !info.tokenMasked) && (
              <p className="text-muted-foreground -mt-3 text-xs">{m.browser_render_needs_setup()}</p>
            )}
            {info.enabled && <BrowserUsage info={info} />}

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save({ ...draft, enabled: info.enabled, limitMinutes: clampBrowserLimit(draft.plan, draft.limitMinutes) });
              }}
            >
              <Field>
                <FieldLabel>{m.browser_render_plan()}</FieldLabel>
                <RadioGroup
                  value={draft.plan}
                  onValueChange={(v) => {
                    const plan = v as BrowserRenderPlan;
                    setDraft({ ...draft, plan, limitMinutes: BROWSER_DEFAULT_LIMIT[plan] });
                  }}
                  className="flex flex-wrap gap-4"
                >
                  {(Object.keys(PLAN_LABELS) as BrowserRenderPlan[]).map((plan) => (
                    <label key={plan} className="flex items-center gap-2 text-sm">
                      <Radio value={plan} />
                      {PLAN_LABELS[plan]()}
                    </label>
                  ))}
                </RadioGroup>
                <p className="text-muted-foreground text-xs">
                  {draft.plan === "free" ? m.browser_render_plan_free_hint() : m.browser_render_plan_paid_hint()}
                </p>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="browser-account">Account ID</FieldLabel>
                  <Input
                    id="browser-account"
                    autoComplete="off"
                    value={draft.accountId}
                    onChange={(e) => setDraft({ ...draft, accountId: e.target.value.trim() })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="browser-limit">
                    {draft.plan === "free" ? m.browser_render_limit_day() : m.browser_render_limit_month()}
                  </FieldLabel>
                  <Input
                    id="browser-limit"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={maxLimit}
                    value={draft.limitMinutes}
                    onChange={(e) => setDraft({ ...draft, limitMinutes: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <Button type="submit" size="sm" disabled={!dirty} loading={saving}>
                {m.common_save()}
              </Button>
            </form>

            <BrowserTokenForm
              masked={info.tokenMasked}
              canSave={!!info.accountId}
              saving={savingToken}
              onSave={saveToken}
              onRemove={removeToken}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
