import { vi } from "vitest";
import type { TestApp } from "./app";

/** Saves an OpenAI-compatible chat endpoint so AI routes are enabled. */
export async function configureChat(t: TestApp) {
  await t.json("/api/settings/ai", {
    json: {
      chat: { provider: "custom", baseUrl: "https://llm.test/v1", apiKey: "k", protocol: "openai-chat", model: "m" },
      embedding: {},
    },
  });
}

export interface ChatCall {
  system: string;
  prompt: string;
}

/**
 * Answers chat completions with `reply(prompt, system)` and records every
 * call, so tests can check what was asked (e.g. the output language).
 */
export function stubChatModel(reply: (prompt: string, system: string) => string): ChatCall[] {
  const calls: ChatCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const text = (m: { content: unknown }) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content));
      const system = body.messages.filter((m: { role: string }) => m.role === "system").map(text).join("\n");
      const prompt = text(body.messages.at(-1));
      calls.push({ system, prompt });
      return Response.json({
        id: "x",
        object: "chat.completion",
        created: 0,
        model: "m",
        choices: [{ index: 0, message: { role: "assistant", content: reply(prompt, system) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    }),
  );
  return calls;
}
