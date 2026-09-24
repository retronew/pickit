import { describe, expect, it } from "vitest";
import { categoryTree, isWithinCategory, joinCategory, parentCategory } from "./categories";

const row = (category: string) => ({ category, count: 1, total: 1 });

describe("categoryTree", () => {
  it("puts each parent right before its children", () => {
    const tree = categoryTree([row("前端-工具"), row("前端/React"), row("后端"), row("前端")]);
    expect(tree.map((n) => [n.category, n.name, n.depth])).toEqual([
      ["后端", "后端", 0],
      ["前端", "前端", 0],
      ["前端/React", "React", 1],
      ["前端-工具", "前端-工具", 0],
    ]);
  });
});

describe("parentCategory", () => {
  it("drops the last level", () => {
    expect(parentCategory("前端/React")).toBe("前端");
    expect(parentCategory("前端")).toBe("");
  });
});

describe("isWithinCategory / joinCategory", () => {
  it("matches the category and its descendants only", () => {
    expect(isWithinCategory("前端", "前端")).toBe(true);
    expect(isWithinCategory("前端/React", "前端")).toBe(true);
    expect(isWithinCategory("前端工具", "前端")).toBe(false);
  });

  it("joins under a parent, or at the top level", () => {
    expect(joinCategory("前端", "React")).toBe("前端/React");
    expect(joinCategory("", "React")).toBe("React");
  });
});
