import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe as suite, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@pickit/shared";
import { describe } from "./describe";
import { hasMessage, type MessageRef } from "@pickit/shared/i18n";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Every `action: "x.y"` literal in the API source. */
function literalActions(): string[] {
  const found = new Set<string>();
  for (const file of sourceFiles(srcDir)) {
    for (const m of readFileSync(file, "utf8").matchAll(/action: "([a-z]+\.[a-z_]+)"/g)) found.add(m[1]);
  }
  return [...found];
}

/** Actions built from request data (bulk actions, job controls). */
function templatedActions(): string[] {
  const bulk = ["delete", "restore", "purge", "pin", "unpin", "category", "add_tags", "remove_tags", "apply"].map(
    (action) => describe("POST", "/api/items/bulk", { ids: [1], action }, undefined, {})!.action,
  );
  const jobs = ["start", "pause", "resume", "retry"].map(
    (verb) => describe("POST", `/api/jobs/reembed/${verb}`, {}, undefined, {})!.action,
  );
  return [...bulk, ...jobs];
}

suite("audit action labels", () => {
  // AUDIT_ACTIONS is what gets a translated label (see shared audit.test.ts).
  it("lists every action the API records", () => {
    const actions = [...literalActions(), ...templatedActions()];
    expect(actions.length).toBeGreaterThan(30);
    const known: readonly string[] = AUDIT_ACTIONS;
    const missing = actions.filter((a) => !known.includes(a));
    expect(missing).toEqual([]);
  });
});


/** Every message key in a ref, including nested params. */
function keys(ref: MessageRef): string[] {
  return [
    ref.key,
    ...Object.values(ref.params ?? {}).flatMap((v) => (typeof v === "object" ? keys(v) : [])),
  ];
}

const REQUESTS: [string, string, Record<string, unknown>, Record<string, unknown>?][] = [
  ["PUT", "/api/items/1", { pinned: true }],
  ["PUT", "/api/items/1", { pinned: false }],
  ["PUT", "/api/items/1", { name: "x" }],
  ["POST", "/api/items/1/translate", { save: true }],
  ["DELETE", "/api/items/1", {}],
  ...["restore", "purge", "summarize", "translate", "check", "reembed", "visit"].map(
    (sub) => ["POST", `/api/items/1/${sub}`, {}] as [string, string, Record<string, unknown>],
  ),
  ["POST", "/api/items", { name: "x", allowDuplicate: true }, { id: 1 }],
  ["POST", "/api/items/analyze", { url: "https://x" }],
  ["POST", "/api/items/import", { dryRun: true }],
  ["POST", "/api/items/import", { format: "json" }, { inserted: 1, skipped: 0 }],
  ["GET", "/api/items/export", {}],
  ["POST", "/api/items/merge", { keepId: 1, removeIds: [2] }],
  ["POST", "/api/items/suggest", { ids: [1] }],
  ...["delete", "pin", "unpin", "purge", "restore", "apply", "weird"].map(
    (action) => ["POST", "/api/items/bulk", { ids: [1], action }] as [string, string, Record<string, unknown>],
  ),
  ["POST", "/api/items/bulk", { ids: [1], action: "category", value: "" }],
  ["POST", "/api/items/bulk", { ids: [1], action: "add_tags", tags: ["a"] }],
  ["POST", "/api/items/bulk", { ids: [1], action: "remove_tags", tags: ["a"] }],
  ["POST", "/api/tags/rename", { from: "a", to: "b" }],
  ["POST", "/api/tags/delete", { tag: "a" }],
  ["POST", "/api/shares", { type: "category", value: "x" }],
  ["POST", "/api/shares", { type: "tag", value: "x" }],
  ["POST", "/api/shares", { type: "item", value: "1", title: "t" }],
  ["DELETE", "/api/shares/abc", {}],
  ["POST", "/api/settings/ai", {}],
  ["POST", "/api/settings/ai/models", { target: "embedding" }],
  ["POST", "/api/settings/ai/models", { target: "chat" }],
  ["POST", "/api/settings/ai/test", { target: "embedding" }],
  ["POST", "/api/settings/ai/test", { target: "chat" }],
  ["POST", "/api/settings/api-token/reset", {}],
  ["DELETE", "/api/settings/api-token", {}],
  ["PUT", "/api/settings/allowed-emails", { emails: [] }],
  ["PUT", "/api/settings/locale", { locale: "en" }],
  ["PUT", "/api/settings/saved-searches", [] as unknown as Record<string, unknown>],
  ["PUT", "/api/audit/settings", { retentionDays: 0 }, { deleted: 2 }],
  ["PUT", "/api/audit/settings", { retentionDays: 30 }],
  ["POST", "/api/backups", {}, { name: "n", count: 1 }],
  ["POST", "/api/backups/n/restore", { mode: "merge", dryRun: true }],
  ["POST", "/api/backups/n/restore", { mode: "replace" }, { inserted: 1, skipped: 0, trashed: 1 }],
  ["GET", "/api/backups/n", {}],
  ["DELETE", "/api/backups/n", {}],
  ["POST", "/api/chat", {}],
  ["POST", "/api/auth/sign-out", {}],
  ...["start", "pause", "resume", "retry"].map(
    (verb) => ["POST", `/api/jobs/reembed/${verb}`, { mode: "all" }] as [string, string, Record<string, unknown>],
  ),
  ["POST", "/api/jobs/organize/start", {}],
  ["POST", "/api/jobs/summarize/start", { mode: "missing" }],
  ...["search_bookmarks", "add_bookmark", "get_bookmark", "list_tags"].map(
    (name) =>
      ["POST", "/api/mcp", { method: "tools/call", params: { name, arguments: { query: "q", url: "u", id: 1 } } }] as [
        string,
        string,
        Record<string, unknown>,
      ],
  ),
];

suite("audit summaries", () => {
  it("only use message keys that exist in the catalogs", () => {
    const missing: string[] = [];
    for (const [method, path, body, res] of REQUESTS) {
      const d = describe(method, path, body, "Name", res ?? {});
      if (!d) throw new Error(`not described: ${method} ${path}`);
      missing.push(...keys(d.summary).filter((k) => !hasMessage(k)));
    }
    // Written outside describe(): sign-in hooks and the cron handler.
    for (const k of ["sign_in", "sign_in_denied", "unknown_provider", "daily_backup", "daily_backup_failed", "link_check"]) {
      if (!hasMessage(`audit_sum_${k}`)) missing.push(`audit_sum_${k}`);
    }
    expect(missing).toEqual([]);
  });
});
