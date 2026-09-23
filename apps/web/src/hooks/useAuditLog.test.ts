import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, toParams } from "./useAuditLog";

describe("audit query params", () => {
  it("omits empty filters", () => {
    expect(toParams(EMPTY_FILTERS, { limit: 50 })).toBe("limit=50");
  });

  it("sends filters and a whole-day local time range", () => {
    const p = new URLSearchParams(
      toParams({
        ...EMPTY_FILTERS,
        category: "item",
        result: "error",
        q: "Vite",
        from: "2026-09-01",
        to: "2026-09-03",
      }),
    );
    expect(p.get("category")).toBe("item");
    expect(p.get("result")).toBe("error");
    expect(p.get("q")).toBe("Vite");
    expect(Number(p.get("from"))).toBe(new Date(2026, 8, 1).getTime());
    expect(Number(p.get("to"))).toBe(new Date(2026, 8, 4).getTime() - 1);
  });

  it("treats a start day without an end as that single day", () => {
    const p = new URLSearchParams(toParams({ ...EMPTY_FILTERS, from: "2026-09-01" }));
    expect(Number(p.get("to")) - Number(p.get("from"))).toBe(86_400_000 - 1);
  });
});
