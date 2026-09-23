import { Hono } from "hono";
import { APICallError, RetryError } from "ai";
import {
  normalizeBaseUrl,
  upgradeAiSettings,
  resolveEmbeddingEndpoint,
  findProvider,
  CUSTOM_PROVIDER,
  isChatConfigured,
  isEmbeddingConfigured,
  chatRequestUrls,
  embeddingRequestUrls,
  type AiSettings,
  type AiEndpoint,
} from "@pickit/shared";
import type { Env } from "#types";
import { getRawSettings, saveSettings, getApiToken, setApiToken } from "#settings";
import { createChatModel, createEmbeddingModel } from "#ai";
import { listModels, ModelListError, type ModelFamily } from "#ai-models";

export const settingsRoutes = new Hono<{ Bindings: Env }>();

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function origin(url: string): string | null {
  try {
    return new URL(normalizeBaseUrl(url)).origin;
  } catch {
    return null;
  }
}

/**
 * An empty key in the form means "keep the saved one" — but only while the
 * endpoint still points at the same provider and server (origin), so a saved
 * key is never sent to a different host. Path changes such as adding /v1 are
 * fine.
 */
function keepKey<P extends string>(incoming: AiEndpoint<P>, saved: AiEndpoint<P>): string {
  if (incoming.apiKey) return incoming.apiKey;
  const target = origin(incoming.baseUrl);
  const sameTarget =
    incoming.provider === saved.provider && target !== null && target === origin(saved.baseUrl);
  return sameTarget ? saved.apiKey : "";
}

function mergeWithSaved(body: unknown, saved: AiSettings): AiSettings {
  const next = upgradeAiSettings({ ...(body as object), version: 2 });
  next.chat.baseUrl = normalizeBaseUrl(next.chat.baseUrl);
  next.embedding.baseUrl = normalizeBaseUrl(next.embedding.baseUrl);
  next.chat.apiKey = keepKey(next.chat, saved.chat);
  next.embedding.apiKey = next.embedding.inheritChat
    ? ""
    : keepKey(next.embedding, saved.embedding);
  return next;
}

function describeError(e: unknown): string {
  const err = RetryError.isInstance(e) ? e.lastError : e;
  if (APICallError.isInstance(err)) {
    const body = typeof err.responseBody === "string" ? err.responseBody.slice(0, 200) : "";
    return [err.statusCode, err.url, body || err.message].filter(Boolean).join(" · ");
  }
  return String(err).slice(0, 300);
}

settingsRoutes.get("/ai", async (c) => {
  const s = await getRawSettings(c.env.DB);
  return c.json({
    chat: { ...s.chat, apiKey: "", apiKeyMasked: maskKey(s.chat.apiKey) },
    embedding: { ...s.embedding, apiKey: "", apiKeyMasked: maskKey(s.embedding.apiKey) },
    chatConfigured: isChatConfigured(s),
    embeddingConfigured: isEmbeddingConfigured(s),
  });
});

settingsRoutes.post("/ai", async (c) => {
  const saved = await getRawSettings(c.env.DB);
  const next = mergeWithSaved(await c.req.json(), saved);
  await saveSettings(c.env.DB, next);
  return c.json({
    ok: true,
    chatConfigured: isChatConfigured(next),
    embeddingConfigured: isEmbeddingConfigured(next),
  });
});

settingsRoutes.post("/ai/models", async (c) => {
  const body = await c.req.json<{ target: "chat" | "embedding"; settings: unknown }>();
  const next = mergeWithSaved(body.settings, await getRawSettings(c.env.DB));
  // An inheriting embedding endpoint lists models from the chat provider.
  const endpoint =
    body.target === "chat" || next.embedding.inheritChat ? next.chat : next.embedding;
  if (!endpoint.baseUrl) return c.json({ error: "请先填写接口地址" }, 400);
  if (
    !endpoint.apiKey &&
    endpoint.provider !== CUSTOM_PROVIDER &&
    !findProvider(endpoint.provider)?.keyOptional
  ) {
    return c.json({ error: "请先填写 API 密钥，再获取模型列表" }, 400);
  }
  const family: ModelFamily =
    endpoint.protocol === "anthropic"
      ? "anthropic"
      : endpoint.protocol === "google"
        ? "google"
        : "openai";
  try {
    const result = await listModels(family, endpoint.baseUrl, endpoint.apiKey);
    return c.json(result);
  } catch (e) {
    return c.json(
      { error: e instanceof ModelListError ? e.message : describeError(e) },
      400,
    );
  }
});

settingsRoutes.post("/ai/test", async (c) => {
  const body = await c.req.json<{ target: "chat" | "embedding"; settings: unknown }>();
  const next = mergeWithSaved(body.settings, await getRawSettings(c.env.DB));

  if (body.target === "chat") {
    const e = next.chat;
    const urls = chatRequestUrls(e.protocol, e.baseUrl, e.model);
    if (!isChatConfigured(next)) {
      return c.json({ ok: false, urls, error: "请填写服务商、接口地址、密钥和模型" });
    }
    try {
      const { generateText } = await import("ai");
      const { text } = await generateText({
        model: createChatModel(e),
        prompt: "回复 ok",
        maxOutputTokens: 16, // responses API 要求 >= 16
        maxRetries: 0,
      });
      return c.json({ ok: true, urls, reply: text.slice(0, 100) });
    } catch (err) {
      return c.json({ ok: false, urls, error: describeError(err) });
    }
  }

  const e = resolveEmbeddingEndpoint(next);
  const urls = e ? embeddingRequestUrls(e.protocol, e.baseUrl, e.model) : [];
  if (!e || !isEmbeddingConfigured(next)) {
    return c.json({ ok: false, urls, error: "向量模型配置不完整" });
  }
  try {
    const { embed } = await import("ai");
    const { embedding } = await embed({
      model: createEmbeddingModel(e),
      value: "test",
      maxRetries: 0,
    });
    return c.json({ ok: true, urls, dimensions: embedding.length });
  } catch (err) {
    return c.json({ ok: false, urls, error: describeError(err) });
  }
});

settingsRoutes.get("/api-token", async (c) => {
  const token = await getApiToken(c.env.DB);
  return c.json({ configured: !!token, masked: token ? maskKey(token) : null });
});

settingsRoutes.post("/api-token/reset", async (c) => {
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await setApiToken(c.env.DB, token);
  return c.json({ token });
});

settingsRoutes.delete("/api-token", async (c) => {
  await c.env.DB.prepare("DELETE FROM settings WHERE key = 'api_token'").run();
  return c.json({ ok: true });
});
