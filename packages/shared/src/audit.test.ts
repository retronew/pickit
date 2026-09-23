import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  auditActionCategory,
  auditActionLabel,
  auditCategoryLabel,
} from "./audit";
import { locales } from "./i18n";

describe("audit labels", () => {
  it("labels known actions in each language", () => {
    expect(auditActionLabel("item.create", "zh")).toBe("添加收藏");
    expect(auditActionLabel("item.create", "en")).toBe("Add bookmark");
    expect(auditActionLabel("item.create", "ja")).toBe("ブックマーク追加");
  });

  it("falls back to the category for unknown actions", () => {
    expect(auditActionLabel("item.teleport", "zh")).toBe("收藏 · item.teleport");
    expect(auditActionLabel("weird", "en")).toBe("Other · weird");
  });

  it.each(locales)("has a real label for every action and category in %s", (locale) => {
    for (const action of AUDIT_ACTIONS) {
      expect(auditActionLabel(action, locale), action).not.toContain(action);
    }
    for (const category of AUDIT_CATEGORIES) {
      expect(auditCategoryLabel(category, locale), category).not.toBe(category);
    }
  });

  it("maps every action prefix to a known category", () => {
    for (const action of AUDIT_ACTIONS) {
      expect(AUDIT_CATEGORIES).toContain(auditActionCategory(action));
    }
  });
});
