import { Hono } from "hono";
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
import { createChatModel, createEmbeddingModel, describeError } from "#ai";
import { listModels, ModelListError, type ModelFamily } from "#ai-models";
import { ownerEmails, getExtraEmails, setExtraEmails, parseEmails, isValidEmail } from "#auth";
import { isLocale } from "@pickit/shared/i18n";
import { getLocalePrefs, setLocalePrefs, isAiLanguage, type LocalePrefs } from "#locale";

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
  next.embedding.apiKey = keepKey(next.embedding, saved.embedding);
  return next;
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
  const endpoint = body.target === "chat" ? next.chat : next.embedding;
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

// Emails allowed to sign in. Owners (the ALLOWED_EMAILS secret) are read-only
// here; the extra list is stored in the settings table.
settingsRoutes.get("/allowed-emails", async (c) => {
  return c.json({ owners: ownerEmails(c.env), emails: await getExtraEmails(c.env.DB) });
});

settingsRoutes.put("/allowed-emails", async (c) => {
  const body = await c.req.json<{ emails?: unknown }>().catch(() => ({}) as { emails?: unknown });
  if (!Array.isArray(body.emails)) return c.json({ error: "emails must be an array" }, 400);
  const emails = parseEmails(body.emails.filter((e) => typeof e === "string").join(","));
  const invalid = emails.filter((e) => !isValidEmail(e));
  if (invalid.length) return c.json({ error: `邮箱格式不正确：${invalid.join(", ")}` }, 400);
  const owners = new Set(ownerEmails(c.env));
  const extra = emails.filter((e) => !owners.has(e));
  await setExtraEmails(c.env.DB, extra);
  return c.json({ owners: [...owners], emails: extra });
});

settingsRoutes.get("/locale", async (c) => c.json(await getLocalePrefs(c.env.DB)));

/** body: { locale?: "zh" | "en" | "ja", aiLanguage?: "auto" | locale } */
settingsRoutes.put("/locale", async (c) => {
  const body = await c.req.json<{ locale?: unknown; aiLanguage?: unknown }>().catch(() => ({}) as Record<string, unknown>);
  if (body.locale !== undefined && !isLocale(body.locale)) return c.json({ error: "unsupported locale" }, 400);
  if (body.aiLanguage !== undefined && !isAiLanguage(body.aiLanguage)) {
    return c.json({ error: "unsupported aiLanguage" }, 400);
  }
  await setLocalePrefs(c.env.DB, body as Partial<LocalePrefs>);
  return c.json(await getLocalePrefs(c.env.DB));
});
