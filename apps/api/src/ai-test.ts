// The "test" button of the AI settings: one small chat request, streamed so
// the time to the first token can be measured, plus usage and whether the
// model thought before answering.

import type { ChatEndpoint, ChatTestReport } from "@pickit/shared";
import type { LanguageModel } from "ai";

const REASONING_EXCERPT = 300;

/** `model` is `createChatModel(e)`; `e` supplies the configured model id and reasoning level. */
export async function testChat(model: LanguageModel, e: ChatEndpoint): Promise<ChatTestReport> {
  const { streamText } = await import("ai");
  const startedAt = Date.now();
  let firstTokenAt: number | null = null;
  let reasoningText = "";
  const result = streamText({
    model,
    prompt: "Reply with: ok",
    // Room for thinking before the one-word answer; tiny limits leave the answer empty.
    maxOutputTokens: 2048,
    maxRetries: 0,
  });
  for await (const part of result.fullStream) {
    if (part.type === "error") throw part.error;
    if (part.type === "text-delta" || part.type === "reasoning-delta") {
      firstTokenAt ??= Date.now();
      if (part.type === "reasoning-delta" && reasoningText.length < REASONING_EXCERPT) reasoningText += part.text;
    }
  }
  const durationMs = Date.now() - startedAt;
  const [text, usage, response, finishReason] = await Promise.all([
    result.text,
    result.totalUsage,
    result.response,
    result.finishReason,
  ]);
  return {
    reply: text.slice(0, 100),
    modelId: response.modelId || e.model,
    reasoning: e.reasoning,
    durationMs,
    firstTokenMs: firstTokenAt === null ? null : firstTokenAt - startedAt,
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? null,
    reasoningText: reasoningText.slice(0, REASONING_EXCERPT),
    finishReason,
  };
}
