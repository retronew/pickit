import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard for the soft-delete feature: every read path that lists
// or searches items must exclude soft-deleted rows, or they'd "come back
// from the dead" in the UI. This is a static source check rather than a
// D1 integration test (no easy in-memory D1 in this project), but it's
// cheap and catches the most common mistake: forgetting the filter when
// adding a new query.
const here = dirname(fileURLToPath(import.meta.url));

function read(relPath: string): string {
  return readFileSync(join(here, relPath), "utf8");
}

describe("soft-delete filtering", () => {
  it("items.ts filters deleted_at on every active-item read path", () => {
    const src = read("routes/items.ts");
    const occurrences = src.match(/deleted_at IS NULL/g) ?? [];
    // GET /, GET /trash(inverted), /categories, /analyze categories,
    // findDuplicate, /:id/related fallback, /duplicates, reembed-all,
    // organize-all, /export — this is a floor, not an exact count, so
    // the test fails loud if someone deletes a filter rather than only
    // when the exact number drifts from adding new ones.
    expect(occurrences.length).toBeGreaterThanOrEqual(8);
  });

  it("search.ts excludes deleted items from FTS, LIKE fallback, and semantic search", () => {
    const src = read("routes/search.ts");
    expect(src).toMatch(/deleted_at IS NULL/);
    const occurrences = src.match(/deleted_at IS NULL/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
  });

  it("chat.ts excludes deleted items from the retrieval context", () => {
    const src = read("routes/chat.ts");
    expect(src).toMatch(/deleted_at IS NULL/);
  });
});
