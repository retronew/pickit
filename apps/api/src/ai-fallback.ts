// A chat model that tries several endpoints in order, so one provider being
// down doesn't break organizing, summaries or chat.

import type { LanguageModelV4, LanguageModelV4CallOptions } from "@ai-sdk/provider";

/**
 * Calls each model in turn until one answers. A stream only falls back when
 * opening it fails (bad key, 5xx, network); once tokens flow it is committed.
 * An aborted call is never retried on the next model.
 */
export function fallbackModel(models: LanguageModelV4[]): LanguageModelV4 {
  if (models.length === 1) return models[0];
  const [first] = models;

  async function attempt<T>(
    options: LanguageModelV4CallOptions,
    call: (model: LanguageModelV4) => PromiseLike<T>,
  ): Promise<T> {
    let lastError: unknown;
    for (const model of models) {
      try {
        return await call(model);
      } catch (e) {
        if (options.abortSignal?.aborted) throw e;
        lastError = e;
        console.warn(`AI endpoint ${model.provider}/${model.modelId} failed, trying the next one`, e);
      }
    }
    throw lastError;
  }

  return {
    specificationVersion: "v4",
    provider: first.provider,
    modelId: first.modelId,
    // Only URLs every endpoint accepts natively can be passed through.
    supportedUrls: {},
    doGenerate: (options) => attempt(options, (m) => m.doGenerate(options)),
    doStream: (options) => attempt(options, (m) => m.doStream(options)),
  };
}
