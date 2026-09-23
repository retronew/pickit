import type { AiSettings } from "./ai";

export async function getSettings(db: D1Database): Promise<AiSettings | null> {
  const { results } = await db
    .prepare("SELECT key, value FROM settings WHERE key IN ('ai_config')")
    .all<{ key: string; value: string }>();
  const row = results.find((r) => r.key === "ai_config");
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as AiSettings;
    if (!parsed.baseUrl || !parsed.apiKey || !parsed.chatModel) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSettings(db: D1Database, config: unknown) {
  await db
    .prepare(
      "INSERT INTO settings (key, value) VALUES ('ai_config', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .bind(JSON.stringify(config))
    .run();
}

export async function getApiToken(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = 'api_token'")
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function setApiToken(db: D1Database, token: string) {
  await db
    .prepare(
      "INSERT INTO settings (key, value) VALUES ('api_token', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .bind(token)
    .run();
}
