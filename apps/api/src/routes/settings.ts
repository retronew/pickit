import { Hono } from "hono";
import type { Env } from "#types";
import { getSettings, saveSettings, getApiToken, setApiToken } from "#settings";
import { createProvider, embedText } from "#ai";

export const settingsRoutes = new Hono<{ Bindings: Env }>();

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

settingsRoutes.get("/ai", async (c) => {
  const s = await getSettings(c.env.DB);
  if (!s) return c.json({ configured: false });
  return c.json({
    configured: true,
    baseUrl: s.baseUrl,
    chatModel: s.chatModel,
    embeddingModel: s.embeddingModel ?? "",
    apiMode: s.apiMode ?? "chat",
    apiKeyMasked: maskKey(s.apiKey),
  });
});

settingsRoutes.post("/ai", async (c) => {
  const body = await c.req.json<{
    baseUrl?: string;
    apiKey?: string;
    chatModel?: string;
    embeddingModel?: string;
    apiMode?: "chat" | "responses";
  }>();
  const existing = await getSettings(c.env.DB);
  const config = {
    baseUrl: body.baseUrl ?? existing?.baseUrl ?? "",
    apiKey: body.apiKey ?? existing?.apiKey ?? "",
    chatModel: body.chatModel ?? existing?.chatModel ?? "",
    embeddingModel: body.embeddingModel ?? existing?.embeddingModel ?? "",
    apiMode: body.apiMode ?? existing?.apiMode ?? "chat",
  };
  await saveSettings(c.env.DB, config);
  return c.json({ ok: true });
});

settingsRoutes.post("/ai/test", async (c) => {
  const body = await c.req.json<{
    baseUrl?: string;
    apiKey?: string;
    chatModel?: string;
    embeddingModel?: string;
    apiMode?: "chat" | "responses";
  }>();
  const existing = await getSettings(c.env.DB);
  const config = {
    baseUrl: body.baseUrl || existing?.baseUrl || "",
    apiKey: body.apiKey || existing?.apiKey || "",
    chatModel: body.chatModel || existing?.chatModel || "",
    embeddingModel: body.embeddingModel || existing?.embeddingModel || "",
    apiMode: body.apiMode || existing?.apiMode || "chat",
  };
  const provider = createProvider(config);
  if (!provider) return c.json({ ok: false, error: "配置不完整，请补全后再试" });

  try {
    const { generateText } = await import("ai");
    await generateText({
      model: provider.chat,
      prompt: "回复 ok",
      maxOutputTokens: 16, // responses API 要求 >= 16
    });
    let embeddingOk: boolean | null = null;
    if (config.embeddingModel) {
      const vec = await embedText(provider, "test");
      embeddingOk = !!vec;
    }
    return c.json({ ok: true, embeddingOk });
  } catch (e) {
    return c.json({ ok: false, error: String(e).slice(0, 300) });
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
