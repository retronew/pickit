import { Hono } from "hono";
import {
  normalizeBaseUrl,
  upgradeAiSettings,
  resolveEmbeddingEndpoint,
  findProvider,
  CUSTOM_PROVIDER,
  isChatConfigured,
  isChatEndpointReady,
  isEmbeddingConfigured,
  chatEndpoints,
  withChatEndpoints,
  type ChatEndpoint,
  chatRequestUrls,
  embeddingRequestUrls,
  type AiSettings,
  type AiEndpoint,
  sanitizeSavedSearches,
} from "@pickit/shared";
import type { Env } from "#types";
import { getRawSettings, saveSettings, getApiToken, setApiToken, deleteApiToken, getGithubToken, setGithubToken } from "#settings";
import { githubToken, githubTokenStatus } from "#activity";
import { createChatModel, createEmbeddingModel, describeError } from "#ai";
import { testChat } from "#ai-test";
import { listModels, ModelListError, type ModelFamily } from "#ai-models";
import { ownerEmails, getExtraEmails, setExtraEmails, parseEmails, isValidEmail } from "#auth";
import { isLocale } from "@pickit/shared/i18n";
import { getLocalePrefs, setLocalePrefs, isAiLanguage, type LocalePrefs } from "#locale";
import { localizedError, tr } from "#i18n";
import { browserRenderRoutes } from "#routes/browser-render";

export const settingsRoutes = new Hono<{ Bindings: Env }>();

settingsRoutes.route("/browser-render", browserRenderRoutes);

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
function keepKey<P extends string>(incoming: AiEndpoint<P>, saved: AiEndpoint<P> | undefined): string {
  if (incoming.apiKey || !saved) return incoming.apiKey;
  const target = origin(incoming.baseUrl);
  const sameTarget =
    incoming.provider === saved.provider && target !== null && target === origin(saved.baseUrl);
  return sameTarget ? saved.apiKey : "";
}

/**
 * The saved chat endpoint an incoming one keeps its key from: the same entry
 * (by id, so reordering is fine), else the first one on the same provider and server.
 */
function savedChatFor(incoming: ChatEndpoint, saved: ChatEndpoint[]): ChatEndpoint | undefined {
  const target = origin(incoming.baseUrl);
  return (
    saved.find((s) => s.id === incoming.id) ??
    saved.find((s) => s.provider === incoming.provider && target !== null && origin(s.baseUrl) === target)
  );
}

function mergeWithSaved(body: unknown, saved: AiSettings): AiSettings {
  const next = upgradeAiSettings({ ...(body as object), version: 2 });
  const savedChats = chatEndpoints(saved);
  const chats = chatEndpoints(next).map((e) => {
    const chat = { ...e, baseUrl: normalizeBaseUrl(e.baseUrl) };
    return { ...chat, apiKey: keepKey(chat, savedChatFor(chat, savedChats)) };
  });
  next.embedding.baseUrl = normalizeBaseUrl(next.embedding.baseUrl);
  next.embedding.apiKey = keepKey(next.embedding, saved.embedding);
  return withChatEndpoints(next, chats);
}

/** The chat endpoint a models/test request is about (`index` in fallback order). */
function chatAt(settings: AiSettings, index: unknown): ChatEndpoint | undefined {
  return chatEndpoints(settings)[typeof index === "number" ? index : 0];
}

const maskChat = (e: ChatEndpoint) => ({ ...e, apiKey: "", apiKeyMasked: maskKey(e.apiKey) });

settingsRoutes.get("/ai", async (c) => {
  const s = await getRawSettings(c.env.DB);
  return c.json({
    chat: maskChat(s.chat),
    chatFallbacks: s.chatFallbacks.map(maskChat),
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
  const body = await c.req.json<{ target: "chat" | "embedding"; index?: number; settings: unknown }>();
  const next = mergeWithSaved(body.settings, await getRawSettings(c.env.DB));
  const endpoint = body.target === "chat" ? chatAt(next, body.index) : next.embedding;
  if (!endpoint?.baseUrl) return c.json({ error: await tr(c, "api_need_base_url") }, 400);
  if (
    !endpoint.apiKey &&
    endpoint.provider !== CUSTOM_PROVIDER &&
    !findProvider(endpoint.provider)?.keyOptional
  ) {
    return c.json({ error: await tr(c, "ai_need_key") }, 400);
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
    if (e instanceof ModelListError) return localizedError(c, e);
    return c.json({ error: describeError(e) }, 400);
  }
});

settingsRoutes.post("/ai/test", async (c) => {
  const body = await c.req.json<{ target: "chat" | "embedding"; index?: number; settings: unknown }>();
  const next = mergeWithSaved(body.settings, await getRawSettings(c.env.DB));

  if (body.target === "chat") {
    const e = chatAt(next, body.index);
    const urls = e ? chatRequestUrls(e.protocol, e.baseUrl, e.model) : [];
    if (!e || !isChatEndpointReady(e)) {
      return c.json({ ok: false, urls, error: await tr(c, "api_chat_incomplete") });
    }
    const startedAt = Date.now();
    try {
      return c.json({ ok: true, urls, ...(await testChat(createChatModel(e, { db: c.env.DB, feature: "test" }), e)) });
    } catch (err) {
      return c.json({ ok: false, urls, durationMs: Date.now() - startedAt, error: describeError(err) });
    }
  }

  const e = resolveEmbeddingEndpoint(next);
  const urls = e ? embeddingRequestUrls(e.protocol, e.baseUrl, e.model) : [];
  if (!e || !isEmbeddingConfigured(next)) {
    return c.json({ ok: false, urls, error: await tr(c, "api_embedding_incomplete") });
  }
  const startedAt = Date.now();
  try {
    const { embed } = await import("ai");
    const { embedding } = await embed({
      model: createEmbeddingModel(e, { db: c.env.DB, feature: "test" }),
      value: "test",
      maxRetries: 0,
    });
    return c.json({ ok: true, urls, dimensions: embedding.length, durationMs: Date.now() - startedAt });
  } catch (err) {
    return c.json({ ok: false, urls, durationMs: Date.now() - startedAt, error: describeError(err) });
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
  await deleteApiToken(c.env.DB);
  return c.json({ ok: true });
});

// GitHub token for project activity checks: masked when read, verified with
// GitHub before it is saved. `fromSecret`: a GITHUB_TOKEN secret is set instead.
// /status asks GitHub live (quota, expiry) about whichever token is in use.
settingsRoutes.get("/github-token", async (c) => {
  const token = await getGithubToken(c.env.DB);
  return c.json({ masked: token ? maskKey(token) : null, fromSecret: !token && !!c.env.GITHUB_TOKEN });
});

settingsRoutes.put("/github-token", async (c) => {
  const { token } = await c.req.json<{ token?: unknown }>().catch(() => ({ token: undefined }));
  if (typeof token !== "string" || !token.trim() || token.length > 300) {
    return c.json({ error: await tr(c, "api_github_token_invalid") }, 400);
  }
  const status = await githubTokenStatus(token.trim()).catch(() => null);
  if (!status) return c.json({ error: await tr(c, "api_github_token_rejected") }, 400);
  await setGithubToken(c.env.DB, token.trim());
  return c.json({ masked: maskKey(token.trim()), ...status });
});

settingsRoutes.get("/github-token/status", async (c) => {
  const token = await githubToken(c.env);
  if (!token) return c.json({ configured: false });
  const status = await githubTokenStatus(token).catch(() => undefined);
  // undefined: GitHub unreachable; null: it rejected the token (revoked or expired).
  if (status === undefined) return c.json({ configured: true, reachable: false });
  return c.json({ configured: true, reachable: true, valid: !!status, ...status });
});

settingsRoutes.delete("/github-token", async (c) => {
  await setGithubToken(c.env.DB, null);
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
  if (invalid.length) return c.json({ error: await tr(c, "api_bad_emails", { emails: invalid.join(", ") }) }, 400);
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

const SAVED_SEARCHES_KEY = "saved_searches";

settingsRoutes.get("/saved-searches", async (c) => {
  const row = await c.env.DB.prepare("SELECT value FROM settings WHERE key = ?")
    .bind(SAVED_SEARCHES_KEY)
    .first<{ value: string }>();
  let stored: unknown = [];
  try {
    stored = row ? JSON.parse(row.value) : [];
  } catch {
    // Corrupt value: treat as none.
  }
  return c.json(sanitizeSavedSearches(stored));
});

/** body: SavedSearch[] — replaces the whole list (order is the display order). */
settingsRoutes.put("/saved-searches", async (c) => {
  const list = sanitizeSavedSearches(await c.req.json().catch(() => []));
  await c.env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  )
    .bind(SAVED_SEARCHES_KEY, JSON.stringify(list))
    .run();
  return c.json(list);
});
