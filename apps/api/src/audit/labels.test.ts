import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe as suite, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@pickit/shared";
import { describe } from "./describe";

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
