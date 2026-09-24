import { describe, expect, it } from "vitest";
import type { Item } from "@pickit/shared";
import { categoryCounts, compareManual, inCategory, matchesFilters, resolveHits, sortItems, tagCounts } from "./itemFilters";

let nextId = 1;
function item(patch: Partial<Item>): Item {
  return {
    id: nextId++,
    name: "item",
    url: "",
    icon: "",
    note: "",
    category: "",
    tags: [],
    pinned: false,
    hasEmbedding: false,
    clickCount: 0,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    aiSummary: "",
    httpStatus: null,
    checkedAt: null,
    image: "",
    archiveUrl: "",
    position: null,
    contentStatus: "",
    contentAt: null,
    contentSize: null,
    activity: null,
    ...patch,
  };
}

describe("category and tag filters", () => {
  it("matches a category and its sub-categories only", () => {
    const react = item({ category: "前端/React" });
    expect(inCategory(react, "前端")).toBe(true);
    expect(inCategory(react, "前端/React")).toBe(true);
    expect(inCategory(react, "")).toBe(true);
    expect(inCategory(item({ category: "前端工具" }), "前端")).toBe(false);
  });

  it("requires every selected tag", () => {
    const a = item({ category: "x", tags: ["react", "ui"] });
    expect(matchesFilters(a, "", ["react"])).toBe(true);
    expect(matchesFilters(a, "", ["react", "ui"])).toBe(true);
    expect(matchesFilters(a, "", ["react", "vue"])).toBe(false);
    expect(matchesFilters(a, "y", [])).toBe(false);
  });
});

describe("facet counts", () => {
  it("counts parent categories and skips uncategorized items", () => {
    const items = [
      item({ category: "前端/React" }),
      item({ category: "前端/Vue" }),
      item({ category: "后端" }),
      item({ category: "" }),
    ];
    // localeCompare orders Chinese by pinyin: 后 (hòu) before 前 (qián).
    expect(categoryCounts(items)).toEqual([
      { value: "后端", count: 1 },
      { value: "前端", count: 2 },
      { value: "前端/React", count: 1 },
      { value: "前端/Vue", count: 1 },
    ]);
  });

  it("counts each tag once per item", () => {
    expect(tagCounts([item({ tags: ["a", "a", "b"] }), item({ tags: ["a"] })])).toEqual([
      { value: "a", count: 2 },
      { value: "b", count: 1 },
    ]);
  });
});

describe("sortItems", () => {
  const items = [
    item({ name: "beta", createdAt: 1, updatedAt: 30 }),
    item({ name: "Alpha", createdAt: 3, updatedAt: 10, pinned: true }),
    item({ name: "gamma", createdAt: 2, updatedAt: 20 }),
    item({ name: "delta", createdAt: 5, updatedAt: 5, pinned: true }),
  ];
  const names = (list: Item[]) => list.map((i) => i.name);

  it("keeps server order for the default sort", () => {
    expect(sortItems(items, "pinned")).toBe(items);
  });

  it("sorts within pinned first, then the rest", () => {
    expect(names(sortItems(items, "created"))).toEqual(["delta", "Alpha", "gamma", "beta"]);
    expect(names(sortItems(items, "updated"))).toEqual(["Alpha", "delta", "beta", "gamma"]);
    expect(names(sortItems(items, "name"))).toEqual(["Alpha", "delta", "beta", "gamma"]);
  });
});

describe("manual order", () => {
  it("puts never-reordered items first (newest first), then by position", () => {
    const placed = item({ name: "placed-1", position: 1 });
    const first = item({ name: "placed-0", position: 0 });
    const fresh = item({ name: "fresh", createdAt: 5 });
    const older = item({ name: "older", createdAt: 1 });
    expect(sortItems([placed, older, first, fresh], "manual").map((i) => i.name)).toEqual([
      "fresh",
      "older",
      "placed-0",
      "placed-1",
    ]);
    expect(compareManual(first, placed)).toBeLessThan(0);
  });

  it("ignores pinning", () => {
    const pinned = item({ name: "pinned", pinned: true, position: 1 });
    const plain = item({ name: "plain", position: 0 });
    expect(sortItems([pinned, plain], "manual").map((i) => i.name)).toEqual(["plain", "pinned"]);
  });
});

describe("resolveHits", () => {
  it("keeps the search order but drops deleted items and uses current data", () => {
    const a = item({ name: "a" });
    const b = item({ name: "b" });
    const c = item({ name: "c" });
    const hits = [c, a, b];
    // b was deleted, a was renamed after the search ran.
    const items = [{ ...a, name: "a (edited)" }, c];
    expect(resolveHits(hits, items).map((i) => i.name)).toEqual(["c", "a (edited)"]);
  });
});
