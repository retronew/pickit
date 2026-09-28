import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./test/app";
import { deleteSetting, readSetting, writeSetting } from "#settings-store";

let t: TestApp;

beforeEach(async () => {
  t = await createTestApp();
});

describe("settings store", () => {
  it("serves repeat reads from the cache and keeps it in step with its own writes", async () => {
    const db = t.env.DB;
    expect(await readSetting(db, "locale")).toBeNull();
    // Changed behind the cache's back: the cached value stands until it expires.
    await db.prepare("INSERT INTO settings (key, value) VALUES ('locale', 'ja')").run();
    expect(await readSetting(db, "locale")).toBeNull();
    await writeSetting(db, "locale", "en");
    expect(await readSetting(db, "locale")).toBe("en");
    await deleteSetting(db, "locale");
    expect(await readSetting(db, "locale")).toBeNull();
  });
});
