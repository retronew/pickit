import { describe, expect, it } from "vitest";
import { AUDIT_CATEGORIES, auditActionCategory, auditActionLabel } from "./audit";

describe("audit labels", () => {
  it("labels known actions", () => {
    expect(auditActionLabel("item.create")).toBe("添加收藏");
    expect(auditActionLabel("settings.audit_retention")).toBe("修改审计保留时间");
  });

  it("falls back to the category for unknown actions", () => {
    expect(auditActionLabel("item.teleport")).toBe("收藏 · item.teleport");
    expect(auditActionLabel("weird")).toBe("其他 · weird");
  });

  it("maps every action prefix to a known category", () => {
    expect(auditActionCategory("tag.rename")).toBe("tag");
    expect(auditActionCategory("other")).toBe("other");
    for (const c of ["item", "tag", "share", "settings", "job", "ai", "auth", "system", "other"]) {
      expect(AUDIT_CATEGORIES[c]).toBeTruthy();
    }
  });
});
