import { describe, expect, it } from "vitest";
import {
  COMPACT_DIMS,
  asFloat32,
  compactVector,
  cosine,
  nearest,
  similarGroups,
  vectorColumns,
} from "./vectors";

// Deterministic pseudo-random vectors.
function rng(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32 - 0.5;
  };
}
function randomVector(seed: number, dims = 1024): number[] {
  const r = rng(seed);
  return Array.from({ length: dims }, r);
}
function nudge(v: number[], amount: number, seed: number): number[] {
  const r = rng(seed);
  return v.map((x) => x + amount * r());
}

interface Row {
  id: number;
  category: string;
  model: string;
  full: number[];
}

/** Answers the SELECTs issued by vectors.ts from an in-memory list. */
function fakeDb(rows: Row[]) {
  const stored = rows.map((r) => {
    const cols = vectorColumns(r.full);
    return { ...r, embedding: cols.embedding.buffer, vec: cols.vec.buffer };
  });
  return {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          args = a;
          return stmt;
        },
        async all() {
          if (sql.startsWith("SELECT id, embedding")) {
            return { results: stored.filter((r) => args.includes(r.id)) };
          }
          const [model, excludeId] = args;
          return {
            results: stored.filter((r) => r.model === model && r.id !== excludeId),
          };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
}

describe("compact vectors", () => {
  it("has a fixed size regardless of the model's dimensions", () => {
    expect(compactVector(randomVector(1, 4096))).toHaveLength(COMPACT_DIMS);
    expect(compactVector(randomVector(1, 768))).toHaveLength(COMPACT_DIMS);
  });

  it("roughly preserves cosine similarity", () => {
    const a = randomVector(1);
    const near = nudge(a, 0.3, 2);
    const far = randomVector(3);
    const ca = compactVector(a);
    expect(cosine(ca, compactVector(near))).toBeCloseTo(cosine(a, near), 1);
    expect(Math.abs(cosine(ca, compactVector(far)))).toBeLessThan(0.2);
  });

  it("round-trips full vectors through the stored blob", () => {
    const v = randomVector(5, 16);
    const back = asFloat32(vectorColumns(v).embedding.buffer);
    expect(Array.from(back)).toEqual(Array.from(new Float32Array(v)));
  });
});

describe("nearest", () => {
  const base = randomVector(10);
  const rows: Row[] = [
    { id: 1, category: "a", model: "m", full: nudge(base, 0.1, 11) },
    { id: 2, category: "a", model: "m", full: nudge(base, 0.6, 12) },
    { id: 3, category: "a", model: "m", full: randomVector(13) },
    { id: 4, category: "a", model: "other", full: base },
  ];

  it("ranks by exact similarity and ignores other models", async () => {
    const top = await nearest(fakeDb(rows), base, "m", { limit: 3 });
    expect(top.map((t) => t.id)).toEqual([1, 2, 3]);
    expect(top[0].score).toBeCloseTo(cosine(base, rows[0].full), 5);
  });

  it("applies minScore and excludeId", async () => {
    const top = await nearest(fakeDb(rows), base, "m", { limit: 3, minScore: 0.8, excludeId: 1 });
    expect(top.map((t) => t.id)).toEqual([2]);
  });
});

describe("similarGroups", () => {
  it("groups near-identical items in the same category only", async () => {
    const x = randomVector(20);
    const rows: Row[] = [
      { id: 1, category: "a", model: "m", full: x },
      { id: 2, category: "a", model: "m", full: nudge(x, 0.05, 21) },
      { id: 3, category: "b", model: "m", full: nudge(x, 0.05, 22) },
      { id: 4, category: "a", model: "m", full: randomVector(23) },
    ];
    const groups = await similarGroups(fakeDb(rows), "m", new Set());
    expect(groups.map((g) => g.sort())).toEqual([[1, 2]]);
  });
});
