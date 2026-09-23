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
          <FieldLabel>服务商</FieldLabel>
          <Select
            value={endpoint.provider || null}
            onValueChange={(v) => v && onProviderChange(v as string)}
            items={providerItems}
          >
            <SelectTrigger size="lg">
              <SelectValue placeholder="选择服务商" />
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
          <FieldLabel>接口模式</FieldLabel>
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
          <FieldLabel htmlFor={id("baseUrl")}>接口地址</FieldLabel>
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
              ? "填到版本号为止，通常以 /v1 结尾，不要带 /chat/completions。不确定的话只填域名，点「检测并获取模型」会自动判断要不要加 /v1。"
              : "使用该服务商的官方地址，无需填写。需要使用其他地址时，请选择「自定义」。"}
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
            API 密钥{preset?.keyOptional && "（可选）"}
          </FieldLabel>
          <Input
            id={id("apiKey")}
            size="lg"
            type="password"
            autoComplete="off"
            placeholder={keySaved ? `已保存 ${saved!.apiKeyMasked}，留空表示不修改` : "sk-…"}
            value={endpoint.apiKey}
            onChange={(e) => onChange({ apiKey: e.target.value } as Partial<AiEndpoint<P>>)}
          />
          {!keySaved && saved?.apiKeyMasked && (
            <FieldDescription>服务商或地址变了，之前保存的密钥不会被带过去，请重新填写。</FieldDescription>
          )}
        </Field>
      )}
    </div>
  );
}
