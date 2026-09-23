import type { Env, ItemRow } from "#types";
import { getSettings } from "#settings";
import { createProvider, embedText, embedTexts, describeError, embeddingInput } from "#ai";
import { isChatConfigured, isEmbeddingConfigured, type AiSettings } from "@pickit/shared";
import { stepJob, type JobKind, type JobState, type StepResult } from "#jobs";

/** How many items one step handles. Kept small so a step stays well under Worker limits. */
const BATCH_SIZE: Record<JobKind, number> = { reembed: 32, organize: 4 };

export const JOB_MODES: Record<JobKind, string[]> = {
  reembed: ["missing", "all"],
  organize: ["missing", "all"],
};

/** Why a job can't run with the current settings, or null when it can. */
export function jobConfigError(kind: JobKind, settings: AiSettings | null): string | null {
  if (kind === "reembed") {
    return settings && isEmbeddingConfigured(settings)
      ? null
      : "还没有配置向量模型，请先在上方完成配置";
  }
  return settings && isChatConfigured(settings) ? null : "还没有配置对话模型，请先在上方完成配置";
}

/** The ids a new job should process for the chosen mode. */
export async function selectJobIds(
  env: Env,
  kind: JobKind,
  mode: string,
  settings: AiSettings,
): Promise<number[]> {
  let sql = "SELECT id FROM items WHERE deleted_at IS NULL";
  const binds: unknown[] = [];
  if (kind === "reembed" && mode === "missing") {
    // No vector yet, or one produced by a different model (not comparable).
    sql += " AND (embedding IS NULL OR embedding_model IS NOT ?)";
    binds.push(createProvider(settings)?.embeddingModelId ?? "");
  }
  if (kind === "organize" && mode === "missing") {
    sql += " AND (category = '' OR tags = '[]')";
  }
  const { results } = await env.DB.prepare(`${sql} ORDER BY id`)
    .bind(...binds)
    .all<{ id: number }>();
  return results.map((r) => r.id);
}

async function loadRows(env: Env, ids: number[]): Promise<ItemRow[]> {
  if (!ids.length) return [];
  const { results } = await env.DB.prepare(
    `SELECT * FROM items WHERE deleted_at IS NULL AND id IN (${ids.map(() => "?").join(",")})`,
  )
    .bind(...ids)
    .all<ItemRow>();
  return results;
}

/**
 * When every item in a batch failed the provider itself is likely down or
 * misconfigured; pause the job with the reason instead of marking the whole
 * library as failed.
 */
function assertNotAllFailed(rows: ItemRow[], result: StepResult) {
  if (rows.length > 1 && result.failures.length === rows.length) {
    throw new Error(result.failures[0].error);
  }
}

/** Items deleted since the job started count as done. */
function missingIds(ids: number[], rows: ItemRow[]): number[] {
  const found = new Set(rows.map((r) => r.id));
  return ids.filter((id) => !found.has(id));
}

async function reembedBatch(env: Env, settings: AiSettings, ids: number[]): Promise<StepResult> {
  const provider = createProvider(settings);
  if (!provider?.embedding) throw new Error("向量模型不可用，请检查设置");
  const rows = await loadRows(env, ids);
  const result: StepResult = { doneIds: missingIds(ids, rows), failures: [] };
  if (!rows.length) return result;

  const vectors = new Map<number, number[]>();
  try {
    const all = await embedTexts(provider, rows.map(embeddingInput));
    rows.forEach((r, i) => all?.[i] && vectors.set(r.id, all[i]));
  } catch {
    // Batch rejected: fall back to one-by-one so a single bad item doesn't
    // fail the whole batch, and each failure gets its own error message.
    for (const r of rows) {
      try {
        const v = await embedText(provider, embeddingInput(r));
        if (v) vectors.set(r.id, v);
      } catch (e) {
        result.failures.push({ id: r.id, name: r.name, error: describeError(e) });
      }
    }
  }

  const stmts = [...vectors].map(([id, v]) =>
    env.DB.prepare("UPDATE items SET embedding=?, embedding_model=? WHERE id=?").bind(
      new Uint8Array(new Float32Array(v).buffer),
      provider.embeddingModelId,
      id,
    ),
  );
  if (stmts.length) await env.DB.batch(stmts);
  result.doneIds.push(...vectors.keys());
  assertNotAllFailed(rows, result);
  return result;
}

async function organizeBatch(env: Env, settings: AiSettings, ids: number[]): Promise<StepResult> {
  const chat = createProvider(settings)?.chat;
  if (!chat) throw new Error("对话模型不可用，请检查设置");
  const rows = await loadRows(env, ids);
  const result: StepResult = { doneIds: missingIds(ids, rows), failures: [] };
  const { generateText } = await import("ai");
  const { results: catRows } = await env.DB.prepare(
    "SELECT DISTINCT category FROM items WHERE category != '' AND deleted_at IS NULL",
  ).all<{ category: string }>();
  const categories = catRows.map((r) => r.category);

  const outcomes = await Promise.allSettled(
    rows.map(async (row) => {
      const { text } = await generateText({
        model: chat,
        maxRetries: 1,
        system:
          "你是技术收藏库的整理助手。根据条目信息输出 JSON（不要输出其他内容）：" +
          '{"category":"分类名(简短中文,优先从已有分类中选择；都不合适才新建)","tags":["标签1","标签2"]}',
        prompt:
          `已有分类：${categories.join("、") || "（暂无）"}\n` +
          `名称：${row.name}\nURL：${row.url}\n备注：${row.note}\n` +
          `当前分类：${row.category || "（无）"}\n当前标签：${row.tags}`,
      });
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end < start) throw new Error(`模型没有返回 JSON：${text.slice(0, 100)}`);
      const parsed = JSON.parse(text.slice(start, end + 1)) as {
        category?: string;
        tags?: string[];
      };
      const tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : JSON.parse(row.tags || "[]");
      await env.DB.prepare("UPDATE items SET category=?, tags=?, updated_at=? WHERE id=?")
        .bind(parsed.category || row.category, JSON.stringify(tags), Date.now(), row.id)
        .run();
    }),
  );
  outcomes.forEach((o, i) => {
    const row = rows[i];
    if (o.status === "fulfilled") result.doneIds.push(row.id);
    else result.failures.push({ id: row.id, name: row.name, error: describeError(o.reason) });
  });
  assertNotAllFailed(rows, result);
  return result;
}

/** Advances a job by one batch. Safe to call from several drivers at once. */
export async function runJobStep(env: Env, kind: JobKind): Promise<JobState> {
  return stepJob(env.DB, kind, BATCH_SIZE[kind], async (ids) => {
    const settings = await getSettings(env.DB);
    const configError = jobConfigError(kind, settings);
    if (configError) throw new Error(configError);
    return kind === "reembed"
      ? reembedBatch(env, settings!, ids)
      : organizeBatch(env, settings!, ids);
  });
}

/** Cron driver: keeps running jobs moving while no page is stepping them. */
export async function advanceRunningJobs(env: Env, budgetMs = 25_000) {
  const deadline = Date.now() + budgetMs;
  for (const kind of ["reembed", "organize"] as JobKind[]) {
    while (Date.now() < deadline) {
      const job = await runJobStep(env, kind);
      // Stop when finished/paused, or when another driver holds the lock.
      if (job.status !== "running" || job.lockedUntil) break;
    }
  }
}
