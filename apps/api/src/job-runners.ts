import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { vectorColumns } from "#vectors";
import { getSettings } from "#settings";
import { createProvider, embedText, embedTexts, describeError, embeddingInput } from "#ai";
import { isChatConfigured, isEmbeddingConfigured, type AiSettings } from "@pickit/shared";
import { stepJob, type JobKind, type JobState, type StepResult } from "#jobs";
import type { LanguageModel } from "ai";
import { activeCategories, suggestOrganize } from "#organize";
import { summarizeItem } from "#summarize";
import { errorText, LocalizedError, renderMessage } from "#i18n";
import { aiLocale, uiLocale } from "#locale";
import { dispatchEvent } from "#webhooks";

/** How many items one step handles. Kept small so a step stays well under Worker limits. */
const BATCH_SIZE: Record<JobKind, number> = { reembed: 32, organize: 4, summarize: 4 };

export const JOB_MODES: Record<JobKind, string[]> = {
  reembed: ["missing", "all"],
  organize: ["missing", "all"],
  summarize: ["missing", "all"],
};

/** Why a job can't run with the current settings (a message key), or null when it can. */
export function jobConfigError(kind: JobKind, settings: AiSettings | null): string | null {
  if (kind === "reembed") {
    return settings && isEmbeddingConfigured(settings) ? null : "api_job_needs_embedding";
  }
  return settings && isChatConfigured(settings) ? null : "api_job_needs_chat";
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
  if (kind === "summarize" && mode === "missing") {
    sql += " AND ai_summary = ''";
  }
  const { results } = await env.DB.prepare(`${sql} ORDER BY id`)
    .bind(...binds)
    .all<{ id: number }>();
  return results.map((r) => r.id);
}

async function loadRows(env: Env, ids: number[]): Promise<ItemRow[]> {
  if (!ids.length) return [];
  const { results } = await env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM items WHERE deleted_at IS NULL AND id IN (${ids.map(() => "?").join(",")})`,
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
  if (!provider?.embedding) throw new Error(await errorText(env, "api_embedding_unavailable"));
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

  const stmts = [...vectors].map(([id, v]) => {
    const cols = vectorColumns(v);
    return env.DB.prepare(
      "UPDATE items SET embedding=?, vec=?, embedding_model=? WHERE id=?",
    ).bind(cols.embedding, cols.vec, provider.embeddingModelId, id);
  });
  if (stmts.length) await env.DB.batch(stmts);
  result.doneIds.push(...vectors.keys());
  assertNotAllFailed(rows, result);
  return result;
}

/**
 * Runs `work` for each item of the batch in parallel (one chat call each),
 * collecting per-item failures with a readable error.
 */
async function chatBatch(
  env: Env,
  settings: AiSettings,
  ids: number[],
  work: (chat: LanguageModel, row: ItemRow) => Promise<unknown>,
): Promise<StepResult> {
  const chat = createProvider(settings)?.chat;
  if (!chat) throw new Error(await errorText(env, "api_chat_unavailable"));
  const rows = await loadRows(env, ids);
  const result: StepResult = { doneIds: missingIds(ids, rows), failures: [] };
  const outcomes = await Promise.allSettled(rows.map((row) => work(chat, row)));
  const errorLocale = await uiLocale(env.DB);
  outcomes.forEach((o, i) => {
    const row = rows[i];
    if (o.status === "fulfilled") result.doneIds.push(row.id);
    else {
      const error =
        o.reason instanceof LocalizedError ? renderMessage(o.reason.ref, errorLocale) : describeError(o.reason);
      result.failures.push({ id: row.id, name: row.name, error });
    }
  });
  assertNotAllFailed(rows, result);
  return result;
}

async function organizeBatch(env: Env, settings: AiSettings, ids: number[]): Promise<StepResult> {
  const [categories, locale] = await Promise.all([activeCategories(env.DB), aiLocale(env.DB)]);
  return chatBatch(env, settings, ids, async (chat, row) => {
    const { category, tags } = await suggestOrganize(chat, row, categories, locale);
    await env.DB.prepare("UPDATE items SET category=?, tags=?, updated_at=? WHERE id=?")
      .bind(category, JSON.stringify(tags), Date.now(), row.id)
      .run();
  });
}

async function summarizeBatch(env: Env, settings: AiSettings, ids: number[]): Promise<StepResult> {
  const locale = await aiLocale(env.DB);
  return chatBatch(env, settings, ids, (chat, row) => summarizeItem(env.DB, chat, row, locale));
}

const RUNNERS: Record<JobKind, (env: Env, settings: AiSettings, ids: number[]) => Promise<StepResult>> = {
  reembed: reembedBatch,
  organize: organizeBatch,
  summarize: summarizeBatch,
};

/**
 * Advances a job by one batch. Safe to call from several drivers at once.
 * The step that finishes a job also sends the job.finished webhook.
 */
export async function runJobStep(env: Env, kind: JobKind): Promise<JobState> {
  const startedAt = Date.now();
  const job = await stepJob(env.DB, kind, BATCH_SIZE[kind], async (ids) => {
    const settings = await getSettings(env.DB);
    const configError = jobConfigError(kind, settings);
    if (configError) throw new Error(await errorText(env, configError));
    return RUNNERS[kind](env, settings!, ids);
  });
  if (job.status === "done" && job.finishedAt !== undefined && job.finishedAt >= startedAt) {
    await dispatchEvent(env, "job.finished", {
      kind,
      done: job.done,
      failed: job.failures.length,
      lastError: job.lastError ?? null,
    }).catch(() => {});
  }
  return job;
}

/** Cron driver: keeps running jobs moving while no page is stepping them. */
export async function advanceRunningJobs(env: Env, budgetMs = 25_000) {
  const deadline = Date.now() + budgetMs;
  for (const kind of Object.keys(RUNNERS) as JobKind[]) {
    while (Date.now() < deadline) {
      const job = await runJobStep(env, kind);
      // Stop when finished/paused, or when another driver holds the lock.
      if (job.status !== "running" || job.lockedUntil) break;
    }
  }
}
