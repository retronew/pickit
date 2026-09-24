// Maps an API request to an action name and a summary. Summaries are
// message refs (key + params, see @pickit/shared/i18n) so the audit page can
// show them in any language; all keys are audit_sum_* in the catalogs.

import type { MessageRef } from "@pickit/shared/i18n";
import { mixTitle, normalizeMix } from "#shares";

export type Body = Record<string, any>;

export interface Described {
  action: string;
  target?: string;
  summary: MessageRef;
}

type Params = MessageRef["params"];

const msg = (key: string, params?: Params): MessageRef => ({ key: `audit_sum_${key}`, params });

/** 「name」 in the reader's language; "" when empty. */
const quote = (text: unknown): MessageRef | string =>
  text ? { key: "audit_quote", params: { text: String(text) } } : "";

const JOB_KINDS = new Set(["reembed", "organize", "summarize"]);

const BULK_ACTIONS = new Set([
  "delete",
  "pin",
  "unpin",
  "category",
  "purge",
  "restore",
  "add_tags",
  "remove_tags",
  "apply",
]);

/** MCP tool calls are audited; protocol chatter (initialize, tools/list…) is not. */
function describeMcp(body: Body): Described | false {
  if (body.method !== "tools/call") return false;
  const name = String(body.params?.name ?? "");
  const args = (body.params?.arguments ?? {}) as Body;
  const summary =
    name === "search_bookmarks"
      ? msg("mcp_search", { query: quote(args.query) })
      : name === "add_bookmark"
        ? msg("mcp_add", { url: String(args.url ?? "") })
        : name === "get_bookmark"
          ? msg("mcp_get", { id: String(args.id) })
          : msg("mcp_other", { tool: name });
  return { action: "mcp.call", target: `mcp:${name}`, summary };
}

function describeItem(method: string, id: string, sub: string | undefined, body: Body, name?: string): Described | null {
  const target = `item:${id}`;
  const label = quote(name ?? body.name) || `#${id}`;
  if (!sub && method === "PUT") {
    const keys = Object.keys(body);
    if (keys.length === 1 && keys[0] === "pinned") {
      return body.pinned
        ? { action: "item.pin", target, summary: msg("item_pin", { label }) }
        : { action: "item.unpin", target, summary: msg("item_unpin", { label }) };
    }
    return { action: "item.update", target, summary: msg("item_update", { label }) };
  }
  if (!sub && method === "DELETE") return { action: "item.delete", target, summary: msg("item_delete", { label }) };
  if (sub === "translate" && body.save) return { action: "item.translate", target, summary: msg("item_translate_save", { label }) };
  const subs = ["restore", "purge", "summarize", "translate", "check", "reembed", "visit"];
  if (sub && subs.includes(sub)) return { action: `item.${sub}`, target, summary: msg(`item_${sub}`, { label }) };
  return null;
}

function describeBulk(body: Body): Described {
  const count = body.action === "apply" ? (body.updates ?? []).length : (body.ids ?? []).length;
  const action = String(body.action);
  if (!BULK_ACTIONS.has(action)) return { action: `item.bulk_${action}`, summary: msg("bulk_other", { op: action, count }) };
  const params: Params =
    action === "category"
      ? { count, category: quote(body.value) || { key: "uncategorized" } }
      : Array.isArray(body.tags)
        ? { count, tags: body.tags.map((t: string) => `#${t}`).join(" ") }
        : { count };
  return { action: `item.bulk_${action}`, summary: msg(`bulk_${action}`, params) };
}

function describeBackup(method: string, name: string, restore: boolean, body: Body, res: Body): Described | null {
  const target = `backup:${name}`;
  if (restore) {
    const mode: MessageRef = { key: body.mode === "replace" ? "restore_replace" : "restore_merge" };
    if (body.dryRun) return { action: "backup.restore_preview", target, summary: msg("backup_restore_preview", { name, mode }) };
    const counts =
      res.inserted != null
        ? msg("backup_restore_counts", {
            inserted: res.inserted,
            skipped: res.skipped ?? 0,
            trashed: res.trashed ? msg("backup_restore_trashed", { count: res.trashed }) : "",
          })
        : "";
    return { action: "backup.restore", target, summary: msg("backup_restore", { name, mode, counts }) };
  }
  if (method === "GET") return { action: "backup.download", target, summary: msg("backup_download", { name }) };
  if (method === "DELETE") return { action: "backup.delete", target, summary: msg("backup_delete", { name }) };
  return null;
}

function describeShare(body: Body): MessageRef {
  const what =
    body.type === "category"
      ? msg("share_category", { name: quote(body.value) })
      : body.type === "tag"
        ? msg("share_tag", { name: quote(body.value) })
        : body.type === "mix"
          ? quote(mixTitle(normalizeMix(body.categories, body.tags) ?? { categories: [], tags: [] }))
          : body.type === "collection"
          ? msg("share_collection", { count: Array.isArray(body.ids) ? body.ids.length : 0 })
          : quote(body.title) || `#${body.value}`;
  return msg("share_create", { what });
}

/**
 * Maps a request to an action and summary. `name` is the item's name looked
 * up before the handler ran (for /api/items/:id routes), `res` the JSON
 * response when useful (e.g. the id of a new item). null = not recognized
 * (logged as "other"); false = deliberately not audited.
 */
export function describe(
  method: string,
  path: string,
  body: Body,
  name: string | undefined,
  res: Body,
): Described | null | false {
  const p = path.replace(/^\/api/, "");
  if (p === "/mcp") return method === "POST" ? describeMcp(body) : false;
  let m: RegExpMatchArray | null;

  if ((m = p.match(/^\/items\/(\d+)(?:\/(\w+))?$/))) {
    const item = describeItem(method, m[1], m[2], body, name);
    if (item) return item;
  }

  switch (`${method} ${p}`) {
    case "POST /items":
      return {
        action: "item.create",
        target: res.id ? `item:${res.id}` : undefined,
        summary: msg("item_create", { name: quote(body.name), dup: body.allowDuplicate ? msg("dup_suffix") : "" }),
      };
    case "POST /items/analyze":
      return { action: "item.analyze", summary: msg("item_analyze", { url: String(body.url ?? "") }) };
    case "POST /items/import": {
      const format = body.format ? String(body.format) : msg("unknown_format");
      if (body.dryRun) return { action: "item.import_preview", summary: msg("import_preview", { format }) };
      const counts = res.inserted != null ? msg("import_counts", { inserted: res.inserted, skipped: res.skipped ?? 0 }) : "";
      return { action: "item.import", summary: msg("import", { format, counts }) };
    }
    case "GET /items/export":
      return { action: "item.export", summary: msg("export") };
    case "POST /items/merge":
      return {
        action: "item.merge",
        target: `item:${body.keepId}`,
        summary: msg("merge", { keep: String(body.keepId), count: (body.removeIds ?? []).length }),
      };
    case "POST /items/suggest":
      return { action: "item.suggest", summary: msg("suggest", { count: (body.ids ?? []).length }) };
    case "POST /items/bulk":
      return describeBulk(body);
    case "POST /tags/rename":
      return {
        action: "tag.rename",
        target: `tag:${body.from}`,
        summary: msg("tag_rename", { from: quote(body.from), to: quote(body.to) }),
      };
    case "POST /tags/delete":
      return { action: "tag.delete", target: `tag:${body.tag}`, summary: msg("tag_delete", { tag: quote(body.tag) }) };
    case "POST /categories/rename":
      return {
        action: "category.rename",
        target: `category:${body.from}`,
        summary: msg("category_rename", { from: quote(body.from), to: quote(body.to) }),
      };
    case "POST /categories/delete":
      return {
        action: "category.delete",
        target: `category:${body.category}`,
        summary: msg("category_delete", { category: quote(body.category) }),
      };
    case "POST /shares":
      return { action: "share.create", target: res.slug ? `share:${res.slug}` : undefined, summary: describeShare(body) };
    case "POST /settings/ai":
      return { action: "settings.ai_update", summary: msg("ai_update") };
    case "POST /settings/ai/models":
      return { action: "settings.ai_models", summary: msg(body.target === "embedding" ? "ai_models_embedding" : "ai_models_chat") };
    case "POST /settings/ai/test":
      return { action: "settings.ai_test", summary: msg(body.target === "embedding" ? "ai_test_embedding" : "ai_test_chat") };
    case "POST /settings/api-token/reset":
      return { action: "settings.token_reset", summary: msg("token_reset") };
    case "DELETE /settings/api-token":
      return { action: "settings.token_delete", summary: msg("token_delete") };
    case "PUT /settings/allowed-emails":
      return { action: "settings.allowed_emails", summary: msg("allowed_emails", { count: (body.emails ?? []).length }) };
    case "PUT /settings/locale":
      return {
        action: "settings.locale",
        summary: msg("locale", { locale: String(body.locale ?? "—"), ai: String(body.aiLanguage ?? "—") }),
      };
    case "PUT /settings/saved-searches":
      return {
        action: "settings.saved_searches",
        summary: msg("saved_searches", { count: Array.isArray(body) ? body.length : 0 }),
      };
    case "PUT /audit/settings": {
      const pruned = res.deleted ? msg("retention_pruned", { count: res.deleted }) : "";
      return {
        action: "settings.audit_retention",
        summary:
          body.retentionDays === 0
            ? msg("retention_forever", { pruned })
            : msg("retention_days", { days: Number(body.retentionDays), pruned }),
      };
    }
    case "POST /backups":
      return {
        action: "backup.create",
        target: res.name ? `backup:${res.name}` : undefined,
        summary: msg("backup_create", { count: res.count != null ? msg("backup_count", { count: res.count }) : "" }),
      };
    case "POST /chat":
      return { action: "ai.chat", summary: msg("chat") };
    case "POST /auth/sign-out":
      return { action: "auth.sign_out", summary: msg("sign_out") };
  }

  if ((m = p.match(/^\/backups\/([^/]+?)(\/restore)?$/))) {
    const backup = describeBackup(method, m[1], !!m[2], body, res);
    if (backup) return backup;
  }
  if ((m = p.match(/^\/shares\/([^/]+)$/)) && method === "DELETE") {
    return { action: "share.revoke", target: `share:${m[1]}`, summary: msg("share_revoke", { slug: m[1] }) };
  }
  if ((m = p.match(/^\/shares\/([^/]+)$/)) && method === "PATCH") {
    return {
      action: "share.update",
      target: `share:${m[1]}`,
      summary: msg("share_update", { slug: m[1], title: quote(body.title) }),
    };
  }
  if ((m = p.match(/^\/jobs\/(\w+)\/(start|pause|resume|retry)$/))) {
    // Known jobs get their label; anything else (a 404) shows the raw name.
    const job: MessageRef = JOB_KINDS.has(m[1])
      ? { key: `audit_job_${m[1]}` }
      : { key: "audit_quote", params: { text: m[1] } };
    const mode = body.mode ? msg("mode", { mode: String(body.mode) }) : "";
    return { action: `job.${m[2]}`, target: `job:${m[1]}`, summary: msg(`job_${m[2]}`, { job, mode }) };
  }
  return null;
}
