import { normalizeBaseUrl, isEmbeddingModelId } from "@pickit/shared";

export type ModelFamily = "openai" | "anthropic" | "google";

export interface ModelInfo {
  id: string;
  kind: "chat" | "embedding";
}

export interface ModelListResult {
  /** The base URL that answered; may differ from the input when /v1 was added. */
  baseUrl: string;
  models: ModelInfo[];
}

/**
 * Base URLs to probe for a models list. Relays (one-api / new-api style) and
 * self-hosted servers are often entered without /v1, so try that too.
 */
export function candidateBaseUrls(input: string): string[] {
  const base = normalizeBaseUrl(input);
  const out = [base];
  if (!/\/v\d+[a-z0-9]*$/i.test(base)) out.push(`${base}/v1`);
  return out;
}

function headersFor(family: ModelFamily, apiKey: string): Record<string, string> {
  if (family === "anthropic") {
    return { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  }
  if (family === "google") return { "x-goog-api-key": apiKey };
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

export function parseModels(family: ModelFamily, body: unknown): ModelInfo[] | null {
  if (!body || typeof body !== "object") return null;
  if (family === "google") {
    const models = (body as { models?: unknown }).models;
    if (!Array.isArray(models)) return null;
    return models.flatMap(
      (m: { name?: string; supportedGenerationMethods?: string[] }): ModelInfo[] => {
        if (!m.name) return [];
        const id = m.name.replace(/^models\//, "");
        const methods = m.supportedGenerationMethods ?? [];
        if (methods.includes("embedContent")) return [{ id, kind: "embedding" }];
        if (methods.includes("generateContent")) return [{ id, kind: "chat" }];
        return [];
      },
    );
  }
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  return data.flatMap((m: { id?: string }) =>
    typeof m.id === "string"
      ? [{ id: m.id, kind: isEmbeddingModelId(m.id) ? ("embedding" as const) : ("chat" as const) }]
      : [],
  );
}

export class ModelListError extends Error {}

/** Fetches the model list, probing /v1 when the given base URL doesn't answer. */
export async function listModels(
  family: ModelFamily,
  baseUrl: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ModelListResult> {
  const tried: string[] = [];
  for (const base of candidateBaseUrls(baseUrl)) {
    const url = family === "google" ? `${base}/models?pageSize=1000` : `${base}/models`;
    tried.push(url);
    let res: Response;
    try {
      res = await fetchImpl(url, {
        headers: headersFor(family, apiKey),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      throw new ModelListError(`无法连接 ${url}：${String(e).slice(0, 200)}`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ModelListError(`${url} 返回 ${res.status}：API 密钥无效、已停用，或没有访问模型列表的权限`);
    }
    if (!res.ok) continue;
    const body = await res.json().catch(() => null);
    const models = parseModels(family, body);
    if (models) {
      models.sort((a, b) => a.id.localeCompare(b.id));
      return { baseUrl: base, models };
    }
  }
  throw new ModelListError(`没有找到模型列表接口，已尝试：${tried.join("、")}`);
}
