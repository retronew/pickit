// Records the token usage of every model call through AI SDK middleware, so
// no call site has to remember it. Each endpoint is wrapped before the
// fallback chain, so the row names the model that actually answered, and a
// failed attempt is stored too (it counts as a call).

import type { EmbeddingModelMiddleware, LanguageModelMiddleware } from "ai";
import type { LanguageModelV4Usage } from "@ai-sdk/provider";
import type { AiFeature, AiUsageKind } from "@pickit/shared";

/** Where usage goes and what it is for; passed to the model factories. */
export interface UsageContext {
  db: D1Database;
  feature: AiFeature;
}

/** The endpoint as configured, which reads better than the SDK's provider id. */
export interface UsageLabel {
  provider: string;
  model: string;
}

interface UsageRow {
  kind: AiUsageKind;
  input?: number;
  output?: number;
  reasoning?: number;
  cached?: number;
  error?: unknown;
}

function errorText(e: unknown): string {
  return String(e instanceof Error ? e.message : e).slice(0, 300);
}

/** Never throws: losing a usage row must not fail the AI call. */
async function record(ctx: UsageContext, label: UsageLabel, row: UsageRow) {
  try {
    await ctx.db
      .prepare(
        `INSERT INTO ai_usage (created_at, kind, feature, provider, model, input_tokens, output_tokens,
          reasoning_tokens, cached_tokens, ok, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        Date.now(),
        row.kind,
        ctx.feature,
        label.provider || "custom",
        label.model,
        row.input ?? 0,
        row.output ?? 0,
        row.reasoning ?? 0,
        row.cached ?? 0,
        row.error === undefined ? 1 : 0,
        row.error === undefined ? null : errorText(row.error),
      )
      .run();
  } catch (e) {
    console.warn("Could not record AI usage", e);
  }
}

function chatRow(usage: LanguageModelV4Usage | undefined): UsageRow {
  return {
    kind: "chat",
    input: usage?.inputTokens.total,
    output: usage?.outputTokens.total,
    reasoning: usage?.outputTokens.reasoning,
    cached: usage?.inputTokens.cacheRead,
  };
}

export function chatUsageMiddleware(ctx: UsageContext, label: UsageLabel): LanguageModelMiddleware {
  return {
    specificationVersion: "v4",
    wrapGenerate: async ({ doGenerate }) => {
      try {
        const result = await doGenerate();
        await record(ctx, label, chatRow(result.usage));
        return result;
      } catch (e) {
        await record(ctx, label, { kind: "chat", error: e });
        throw e;
      }
    },
    wrapStream: async ({ doStream }) => {
      let result: Awaited<ReturnType<typeof doStream>>;
      try {
        result = await doStream();
      } catch (e) {
        await record(ctx, label, { kind: "chat", error: e });
        throw e;
      }
      // Usage arrives in the stream's finish part; recorded once it closes.
      let usage: LanguageModelV4Usage | undefined;
      let error: unknown;
      const stream = result.stream.pipeThrough(
        new TransformStream({
          transform(part, controller) {
            if (part.type === "finish") usage = part.usage;
            else if (part.type === "error") error = part.error;
            controller.enqueue(part);
          },
          async flush() {
            await record(ctx, label, error !== undefined ? { ...chatRow(usage), error } : chatRow(usage));
          },
        }),
      );
      return { ...result, stream };
    },
  };
}

export function embeddingUsageMiddleware(ctx: UsageContext, label: UsageLabel): EmbeddingModelMiddleware {
  return {
    wrapEmbed: async ({ doEmbed }) => {
      try {
        const result = await doEmbed();
        await record(ctx, label, { kind: "embedding", input: result.usage?.tokens });
        return result;
      } catch (e) {
        await record(ctx, label, { kind: "embedding", error: e });
        throw e;
      }
    },
  };
}
