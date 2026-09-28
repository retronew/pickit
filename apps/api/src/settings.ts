import {
  upgradeAiSettings,
  emptyAiSettings,
  isChatConfigured,
  isEmbeddingConfigured,
  type AiSettings,
} from "@pickit/shared";
import { readSetting, writeSetting, deleteSetting } from "#settings-store";

/** The stored AI config (upgraded from the legacy single-endpoint format), even if incomplete. */
export async function getRawSettings(db: D1Database): Promise<AiSettings> {
  const raw = await readSetting(db, "ai_config");
  if (!raw) return emptyAiSettings();
  try {
    return upgradeAiSettings(JSON.parse(raw));
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
  await writeSetting(db, "ai_config", JSON.stringify(config));
}

export async function getApiToken(db: D1Database): Promise<string | null> {
  return readSetting(db, "api_token");
}

/** GitHub token for project activity checks, set on the settings page. */
export async function getGithubToken(db: D1Database): Promise<string | null> {
  return (await readSetting(db, "github_token")) || null;
}

export async function setGithubToken(db: D1Database, token: string | null) {
  if (!token) {
    await deleteSetting(db, "github_token");
    return;
  }
  await writeSetting(db, "github_token", token);
}

export async function setApiToken(db: D1Database, token: string) {
  await writeSetting(db, "api_token", token);
}

export async function deleteApiToken(db: D1Database) {
  await deleteSetting(db, "api_token");
}
