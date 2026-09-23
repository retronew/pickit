import { describe, expect, it } from "vitest";
import { createTestApp } from "./app";

describe("test harness", () => {
  it("serves the API against the migrated database", async () => {
    const t = await createTestApp();
    expect(await t.json("/api/health", { auth: false })).toEqual({ ok: true });
    expect(await t.json("/api/items")).toEqual([]);
  });
});
