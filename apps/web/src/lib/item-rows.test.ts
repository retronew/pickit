import { describe, expect, it } from "vitest";
import type { Item } from "#hooks/useItems";
import { toItemRows } from "#lib/item-rows";

const item = (id: number) => ({ id }) as Item;

describe("toItemRows", () => {
  it("emits a heading per group and splits cards into rows of `columns`", () => {
    const rows = toItemRows(
      [
        ["A", [item(1), item(2), item(3)]],
        ["B", [item(4)]],
      ],
      2,
    );
    expect(rows.map((r) => (r.kind === "header" ? `#${r.category}` : r.items.map((i) => i.id).join(",")))).toEqual([
      "#A",
      "1,2",
      "3",
      "#B",
      "4",
    ]);
    expect(rows[0]).toMatchObject({ first: true, count: 3 });
    expect(rows[3]).toMatchObject({ first: false, count: 1 });
  });
});
