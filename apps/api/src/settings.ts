import {
  upgradeAiSettings,
  emptyAiSettings,
  isChatConfigured,
  isEmbeddingConfigured,
  type AiSettings,
} from "@pickit/shared";

/** The stored AI config (upgraded from the legacy single-endpoint format), even if incomplete. */
export async function getRawSettings(db: D1Database): Promise<AiSettings> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = 'ai_config'")
    .first<{ value: string }>();
  if (!row) return emptyAiSettings();
  try {
    return upgradeAiSettings(JSON.parse(row.value));
  } catch {
    return emptyAiSettings();
  }
}

/** The AI config, or null when neither chat nor embedding is usable. */
export async function getSettings(db: D1Database): Promise<AiSettings | null> {
  const s = await getRawSettings(db);
  return isChatConfigured(s) || isEmbeddingConfigured(s) ? s : null;
}

export async function saveSettings(db: D1Database, config: AiSettings) {
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
