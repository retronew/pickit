import { describe as suite, expect, it } from "vitest";
import { renderMessage } from "@pickit/shared/i18n";
import { describe as describeRequest, sanitize, isValidRetention, pruneAudit } from "./index";

/** describe() with its summary rendered, in Chinese unless given. */
function describe(...args: Parameters<typeof describeRequest>) {
  const d = describeRequest(...args);
  return d ? { ...d, summary: renderMessage(d.summary, "zh") } : d;
}

suite("sanitize", () => {
  it("redacts secrets and truncates long values", () => {
    const out = sanitize({
      chat: { apiKey: "sk-123", baseUrl: "https://x" },
      token: "abc",
      content: "x".repeat(500),
      ids: Array.from({ length: 30 }, (_, i) => i),
    }) as any;
    expect(out.chat.apiKey).toBe("***");
    expect(out.chat.baseUrl).toBe("https://x");
    expect(out.token).toBe("***");
    expect(out.content).toBe(`${"x".repeat(200)}…[500]`);
    expect(out.ids).toHaveLength(21);
  });

  it("keeps empty secret fields as-is", () => {
    expect(sanitize({ apiKey: "" })).toEqual({ apiKey: "" });
  });
});

suite("describe", () => {
  it("names item actions with the item's name", () => {
    expect(describe("PUT", "/api/items/7", { pinned: true }, "Recharts", {})).toMatchObject({
      action: "item.pin",
      target: "item:7",
      summary: "置顶收藏「Recharts」",
    });
    expect(describe("PUT", "/api/items/7", { name: "A", note: "" }, "Recharts", {})?.action).toBe(
      "item.update",
    );
    expect(describe("DELETE", "/api/items/7/purge", {}, undefined, {})).toMatchObject({
      action: "item.purge",
      summary: "彻底删除#7",
    });
  });

  it("uses the response for new items and bulk details from the body", () => {
    expect(describe("POST", "/api/items", { name: "Hono" }, undefined, { id: 42 })).toMatchObject({
      action: "item.create",
      target: "item:42",
    });
    expect(
      describe("POST", "/api/items/bulk", { ids: [1, 2, 3], action: "category", value: "前端" }, undefined, {}),
    ).toMatchObject({ action: "item.bulk_category", summary: "批量修改分类 3 项到「前端」" });
  });

  it("covers jobs, shares and settings", () => {
    expect(describe("POST", "/api/jobs/reembed/start", { mode: "missing" }, undefined, {})?.summary).toBe(
      "开始向量索引重建（missing）",
    );
    expect(describe("DELETE", "/api/shares/abc", {}, undefined, {})?.action).toBe("share.revoke");
    expect(describe("POST", "/api/settings/ai", {}, undefined, {})?.action).toBe("settings.ai_update");
    expect(describe("POST", "/api/unknown", {}, undefined, {})).toBeNull();
  });
});


suite("retention", () => {
  it("accepts 0 (forever) up to the maximum, integers only", () => {
    expect(isValidRetention(0)).toBe(true);
    expect(isValidRetention(180)).toBe(true);
    expect(isValidRetention(3650)).toBe(true);
    expect(isValidRetention(3651)).toBe(false);
    expect(isValidRetention(-1)).toBe(false);
    expect(isValidRetention(1.5)).toBe(false);
    expect(isValidRetention("30")).toBe(false);
  });

  it("never deletes anything when kept forever", async () => {
    const db = { prepare: () => { throw new Error("should not query"); } } as unknown as D1Database;
    expect(await pruneAudit(db, 0)).toBe(0);
  });

  it("describes retention changes", () => {
    expect(describe("PUT", "/api/audit/settings", { retentionDays: 0 }, undefined, {})?.summary).toBe(
      "修改审计日志保留时间为永久",
    );
    expect(
      describe("PUT", "/api/audit/settings", { retentionDays: 30 }, undefined, { deleted: 12 })?.summary,
    ).toBe("修改审计日志保留时间为 30 天，清理 12 条");
  });
});

suite("summaries in other languages", () => {
  it("renders the same event in English and Japanese, including nested parts", () => {
    const d = describeRequest("POST", "/api/items/bulk", { ids: [1, 2], action: "category", value: "前端" }, undefined, {});
    if (!d) throw new Error("not described");
    expect(renderMessage(d.summary, "en")).toBe("Moved 2 items to “前端”");
    expect(renderMessage(d.summary, "ja")).toBe("2 件のカテゴリを「前端」に変更");

    const restore = describeRequest("POST", "/api/backups/pickit-x.json/restore", { mode: "replace" }, undefined, {
      inserted: 3,
      skipped: 1,
      trashed: 2,
    });
    if (!restore) throw new Error("not described");
    expect(renderMessage(restore.summary, "en")).toBe(
      "Restored backup pickit-x.json (Replace): 3 restored, 1 skipped, 2 moved to the trash",
    );
  });
});
