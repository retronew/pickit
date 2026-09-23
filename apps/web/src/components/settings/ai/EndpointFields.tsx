// Provider, protocol, base URL, key and model fields for one endpoint.

import {
  AI_PROVIDERS,
  CUSTOM_PROVIDER,
  baseUrlWarnings,
  findProvider,
  type AiEndpoint,
} from "@pickit/shared";
import { Field, FieldLabel, FieldDescription } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "#components/ui/select";
import { PROVIDER_LABELS, originOf } from "./shared";
import type { Target, SavedEndpoint } from "./shared";
import { m } from "#lib/i18n";

export function EndpointFields<P extends string>({
  target,
  endpoint,
  saved,
  providers,
  protocols,
  onProviderChange,
  onChange,
}: {
  target: Target;
  endpoint: AiEndpoint<P>;
  saved?: SavedEndpoint;
  providers: typeof AI_PROVIDERS;
  protocols: { value: P; label: string; hint: string }[];
  onProviderChange: (id: string) => void;
  onChange: (patch: Partial<AiEndpoint<P>>) => void;
}) {
  const preset = findProvider(endpoint.provider);
  const isCustom = endpoint.provider === CUSTOM_PROVIDER;
  const urlEditable = isCustom || !!preset?.customBaseUrl;
  const warnings = baseUrlWarnings(endpoint.baseUrl, urlEditable);
  // Mirrors the API: a saved key is reused only for the same provider and server.
  const keySaved =
    !!saved?.apiKeyMasked &&
    saved.provider === endpoint.provider &&
    originOf(saved.baseUrl) !== null &&
    originOf(saved.baseUrl) === originOf(endpoint.baseUrl);
  const providerItems = Object.fromEntries(
    [...providers.map((p) => p.id), CUSTOM_PROVIDER].map((id) => [id, PROVIDER_LABELS[id]]),
  );
  const protocolItems = Object.fromEntries(protocols.map((p) => [p.value, p.label]));
  const id = (name: string) => `${target}-${name}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>{m.ai_provider()}</FieldLabel>
          <Select
            value={endpoint.provider || null}
            onValueChange={(v) => v && onProviderChange(v as string)}
            items={providerItems}
          >
            <SelectTrigger size="lg">
              <SelectValue placeholder={m.ai_provider_pick()} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(providerItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{m.ai_protocol()}</FieldLabel>
          <Select
            value={endpoint.protocol}
            onValueChange={(v) => v && onChange({ protocol: v as P } as Partial<AiEndpoint<P>>)}
            items={protocolItems}
            disabled={protocols.length <= 1}
          >
            <SelectTrigger size="lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {protocols.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            {protocols.find((p) => p.value === endpoint.protocol)?.hint}
          </FieldDescription>
        </Field>
      </div>
      {endpoint.provider && (
        <Field>
          <FieldLabel htmlFor={id("baseUrl")}>{m.ai_base_url()}</FieldLabel>
          <Input
            id={id("baseUrl")}
            size="lg"
            className="font-mono"
            placeholder={preset?.baseUrl ?? "https://api.example.com/v1"}
            value={endpoint.baseUrl}
            readOnly={!urlEditable}
            onChange={(e) => onChange({ baseUrl: e.target.value } as Partial<AiEndpoint<P>>)}
          />
          <FieldDescription>
            {urlEditable
              ? m.ai_base_url_custom_hint()
              : m.ai_base_url_official_hint()}
          </FieldDescription>
          {warnings.map((w) => (
            <p key={w} className="text-xs text-amber-700 dark:text-amber-400">
              {w}
            </p>
          ))}
        </Field>
      )}
      {endpoint.provider && (
        <Field>
          <FieldLabel htmlFor={id("apiKey")}>
            {preset?.keyOptional ? m.ai_api_key_optional() : m.ai_api_key()}
          </FieldLabel>
          <Input
            id={id("apiKey")}
            size="lg"
            type="password"
            autoComplete="off"
            placeholder={keySaved ? m.ai_key_saved({ masked: saved!.apiKeyMasked }) : "sk-…"}
            value={endpoint.apiKey}
            onChange={(e) => onChange({ apiKey: e.target.value } as Partial<AiEndpoint<P>>)}
          />
          {!keySaved && saved?.apiKeyMasked && (
            <FieldDescription>{m.ai_key_not_carried()}</FieldDescription>
          )}
        </Field>
      )}
    </div>
  );
}
