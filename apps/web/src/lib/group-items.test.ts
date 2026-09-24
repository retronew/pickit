import { describe, expect, it } from "vitest";
import { groupItems } from "./group-items";

const items = [
  { name: "A", category: "前端", tags: ["react", "ui"] },
  { name: "B", category: "", tags: [] },
  { name: "C", category: "后端", tags: ["react"] },
  { name: "D", category: "前端", tags: [] },
];
const names = (groups: ReturnType<typeof groupItems<(typeof items)[number]>>) =>
  groups.map((g) => [g.key, g.items.map((i) => i.name).join("")]);

describe("groupItems", () => {
  it("groups by category, biggest first, uncategorized last", () => {
    expect(names(groupItems(items, "category"))).toEqual([
      ["前端", "AD"],
      ["后端", "C"],
      ["", "B"],
    ]);
  });

  it("puts an item under each of its tags", () => {
    expect(names(groupItems(items, "tag"))).toEqual([
      ["react", "AC"],
      ["ui", "A"],
      ["", "BD"],
    ]);
  });
});
