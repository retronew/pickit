import { normalizeUrl } from "@pickit/shared";
import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";

// JSON backups of all active items in R2 (backups/pickit-*.json): the daily
// cron, manual "back up now", and an automatic snapshot before each restore.

const PREFIX = "backups/";
const RETENTION_MS = 30 * 86_400_000;
const NAME_RE = /^pickit-[\w-]+\.json$/;

export type BackupKind = "daily" | "manual" | "pre-restore";

export interface BackupInfo {
  name: string;
  size: number;
  uploaded: number;
  /** Items in the backup; null for backups written before this was recorded. */
  count: number | null;
  kind: BackupKind;
}

export interface BackupItem {
  name: string;
  url: string;
  icon?: string;
  note?: string;
  category?: string;
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
}

export class BackupError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 503,
  ) {
    super(message);
  }
}

function bucket(env: Env): R2Bucket {
  if (!env.BACKUPS) throw new BackupError("没有配置 R2 备份存储（BACKUPS）", 503);
  return env.BACKUPS;
}

export function isValidBackupName(name: string): boolean {
  return NAME_RE.test(name);
}

function kindOf(name: string, meta?: Record<string, string>): BackupKind {
  const kind = meta?.kind;
  if (kind === "manual" || kind === "pre-restore" || kind === "daily") return kind;
  if (name.includes("pre-restore")) return "pre-restore";
  if (name.includes("manual")) return "manual";
  return "daily";
}

function backupName(kind: BackupKind, now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  if (kind === "daily") return `pickit-${date}.json`;
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  return `pickit-${date}-${time}-${kind}.json`;
}

async function activeItems(db: D1Database): Promise<BackupItem[]> {
  const { results } = await db
    .prepare(`SELECT ${ITEM_COLUMNS} FROM items WHERE deleted_at IS NULL ORDER BY id`)
    .all<ItemRow>();
  return results.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    icon: r.icon,
    note: r.note,
    category: r.category,
    tags: JSON.parse(r.tags || "[]"),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** Writes all active items to R2; the daily backup overwrites the same day's file. */
export async function writeBackup(env: Env, kind: BackupKind): Promise<BackupInfo> {
  const items = await activeItems(env.DB);
  const name = backupName(kind);
  const body = JSON.stringify(items);
  const obj = await bucket(env).put(PREFIX + name, body, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { count: String(items.length), kind },
  });
  return { name, size: obj?.size ?? body.length, uploaded: Date.now(), count: items.length, kind };
}

/** Deletes backups older than 30 days; returns how many. */
export async function pruneBackups(env: Env): Promise<number> {
  const cutoff = Date.now() - RETENTION_MS;
  let removed = 0;
  for (const b of await listBackups(env)) {
    if (b.uploaded < cutoff) {
      await bucket(env).delete(PREFIX + b.name);
      removed++;
    }
  }
  return removed;
}

export async function listBackups(env: Env): Promise<BackupInfo[]> {
  const out: BackupInfo[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket(env).list({ prefix: PREFIX, cursor, include: ["customMetadata"] });
    for (const obj of page.objects) {
      const name = obj.key.slice(PREFIX.length);
      if (!isValidBackupName(name)) continue;
      const count = Number(obj.customMetadata?.count);
      out.push({
        name,
        size: obj.size,
        uploaded: obj.uploaded.getTime(),
        count: Number.isFinite(count) && obj.customMetadata?.count ? count : null,
        kind: kindOf(name, obj.customMetadata),
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => b.uploaded - a.uploaded);
}

export async function getBackupObject(env: Env, name: string): Promise<R2ObjectBody> {
  if (!isValidBackupName(name)) throw new BackupError("备份文件名不合法", 400);
  const obj = await bucket(env).get(PREFIX + name);
  if (!obj) throw new BackupError("备份不存在", 404);
  return obj;
}

export async function deleteBackup(env: Env, name: string) {
  await getBackupObject(env, name);
  await bucket(env).delete(PREFIX + name);
}

async function readBackup(env: Env, name: string): Promise<BackupItem[]> {
  const obj = await getBackupObject(env, name);
  let data: unknown;
  try {
    data = JSON.parse(await obj.text());
  } catch {
    throw new BackupError("备份文件损坏，无法解析", 400);
  }
  if (!Array.isArray(data)) throw new BackupError("备份文件格式不正确", 400);
  return data.filter(
    (i): i is BackupItem => !!i && typeof i === "object" && typeof (i as BackupItem).name === "string",
  );
}

export type RestoreMode = "merge" | "replace";

export interface RestoreResult {
  mode: RestoreMode;
  total: number;
  /** Items added (or that would be, for a dry run). */
  inserted: number;
  /** Items skipped because the URL already exists. */
  skipped: number;
  /** Current items moved to the trash (replace mode). */
  trashed: number;
  /** Snapshot of the data before the restore; null for a dry run. */
  snapshot: string | null;
}

/**
 * Restores a backup. "merge" adds items whose URL isn't saved yet; "replace"
 * moves every current item to the trash first (recoverable), then restores
 * everything. A snapshot of the current data is written before any change.
 */
export async function restoreBackup(
  env: Env,
  name: string,
  mode: RestoreMode,
  dryRun = false,
): Promise<RestoreResult> {
  const rows = await readBackup(env, name);
  const db = env.DB;

  const existing = new Set<string>();
  if (mode === "merge") {
    const { results } = await db
      .prepare("SELECT url_norm FROM items WHERE deleted_at IS NULL AND url_norm != ''")
      .all<{ url_norm: string }>();
    for (const r of results) existing.add(r.url_norm);
  }
  const active = await db
    .prepare("SELECT COUNT(*) AS n FROM items WHERE deleted_at IS NULL")
    .first<{ n: number }>();

  const now = Date.now();
  const seen = new Set<string>();
  const inserts: D1PreparedStatement[] = [];
  let skipped = 0;
  for (const row of rows) {
    const url = typeof row.url === "string" ? row.url : "";
    const urlNorm = normalizeUrl(url);
    if (urlNorm && (existing.has(urlNorm) || seen.has(urlNorm))) {
      skipped++;
      continue;
    }
    if (urlNorm) seen.add(urlNorm);
    const created = Number.isFinite(row.createdAt) ? row.createdAt! : now;
    inserts.push(
      db
        .prepare(
          "INSERT INTO items (name, url, icon, note, category, tags, url_norm, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          row.name,
          url,
          typeof row.icon === "string" ? row.icon : "",
          typeof row.note === "string" ? row.note : "",
          typeof row.category === "string" ? row.category : "",
          JSON.stringify(Array.isArray(row.tags) ? row.tags.filter((t) => typeof t === "string") : []),
          urlNorm,
          created,
          Number.isFinite(row.updatedAt) ? row.updatedAt! : created,
        ),
    );
  }

  const trashed = mode === "replace" ? (active?.n ?? 0) : 0;
  const result: RestoreResult = {
    mode,
    total: rows.length,
    inserted: inserts.length,
    skipped,
    trashed,
    snapshot: null,
  };
  if (dryRun) return result;

  result.snapshot = (await writeBackup(env, "pre-restore")).name;
  if (mode === "replace") {
    await db.prepare("UPDATE items SET deleted_at = ? WHERE deleted_at IS NULL").bind(now).run();
  }
  for (let i = 0; i < inserts.length; i += 50) {
    await db.batch(inserts.slice(i, i + 50));
  }
  return result;
}
