import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./test/app";

let t: TestApp;

beforeEach(async () => {
  t = await createTestApp();
});

const shareError = async (headers: Record<string, string> = {}) =>
  (await t.json("/api/shares", { json: { type: "nope" }, headers }, 400)).error;

describe("API language", () => {
  it("defaults to the base language", async () => {
    expect(await shareError()).toContain("必填");
  });

  it("follows the web app's cookie, then the X-PickIt-Locale header", async () => {
    expect(await shareError({ Cookie: "theme=x; pickit_locale=en" })).toBe(
      "type (item / category / tag) and value are required",
    );
    expect(await shareError({ "X-PickIt-Locale": "ja" })).toContain("必須です");
    expect(await shareError({ Cookie: "pickit_locale=fr" })).toContain("必填");
  });

  it("falls back to the saved interface language", async () => {
    await t.json("/api/settings/locale", { method: "PUT", json: { locale: "en" } });
    expect(await shareError()).toMatch(/are required$/);
  });

  it("stores the interface and AI output languages", async () => {
    expect(await t.json("/api/settings/locale")).toEqual({ locale: null, aiLanguage: "auto" });
    expect(await t.json("/api/settings/locale", { method: "PUT", json: { locale: "ja", aiLanguage: "en" } })).toEqual({
      locale: "ja",
      aiLanguage: "en",
    });
    await t.json("/api/settings/locale", { method: "PUT", json: { locale: "fr" } }, 400);
    await t.json("/api/settings/locale", { method: "PUT", json: { aiLanguage: "xx" } }, 400);
  });

  it("writes audit summaries in the saved language and keeps the message ref", async () => {
    await t.json("/api/settings/locale", { method: "PUT", json: { locale: "en" } });
    await t.json("/api/items", { json: { name: "Vite", url: "https://vite.dev" } }, 201);
    const [entry] = (await t.json("/api/audit?action=item.create")).entries;
    expect(entry.summary).toBe("Added “Vite”");
    expect(entry.detail.message).toMatchObject({ key: "audit_sum_item_create" });
  });

  it("localizes backup errors thrown deep in the backup module", async () => {
    const res = await t.json("/api/backups", { method: "POST", headers: { Cookie: "pickit_locale=en" } }, 503);
    expect(res.error).toBe("R2 backup storage (BACKUPS) isn't configured");
  });
});

describe("markdown / HTML export", () => {
  it("round-trips uncategorized items without inventing a category", async () => {
    await t.json("/api/items", { json: { name: "Loose", url: "https://loose.dev" } }, 201);
    await t.json("/api/items", { json: { name: "Vite", url: "https://vite.dev", category: "前端" } }, 201);

    for (const format of ["markdown", "html"] as const) {
      const exported = await (await t.request(`/api/items/export?format=${format}`)).text();
      const other = await createTestApp();
      await other.json("/api/items/import", { json: { format, content: exported } });
      const items = await other.json("/api/items");
      const byName = Object.fromEntries(items.map((i: { name: string; category: string }) => [i.name, i.category]));
      expect(byName, format).toEqual({ Loose: "", Vite: "前端" });
    }
  });

  it("uses the request language for the table header", async () => {
    await t.json("/api/items", { json: { name: "A", url: "https://a.dev" } }, 201);
    const md = await (await t.request("/api/items/export?format=markdown", { headers: { Cookie: "pickit_locale=en" } })).text();
    expect(md).toContain("| Name | URL | Note |");
  });
});
