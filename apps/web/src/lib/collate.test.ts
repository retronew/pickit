import { describe, expect, it } from "vitest";
import { sortText } from "./collate";
import { groupByCategory } from "./groupItems";

describe("text ordering", () => {
  it("orders Chinese by pinyin and numbers numerically, whatever the runtime locale", () => {
    // zh-CN collation: Chinese by pinyin first, then Latin.
    expect(sortText(["前端", "后端", "数据库", "API"])).toEqual(["后端", "前端", "数据库", "API"]);
    expect(sortText(["v10", "v9", "v1"])).toEqual(["v1", "v9", "v10"]);
  });

  it("groups items by category in the same order", () => {
    const items = [{ category: "前端" }, { category: "后端" }, { category: "" }] as never[];
    expect(groupByCategory(items).map(([c]) => c)).toEqual(["后端", "前端", "未分类"]);
  });
});
