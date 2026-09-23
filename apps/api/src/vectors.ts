// Vector storage and similarity search within the Workers CPU budget.
//
// Full embeddings can be large (4096 floats = 16 KB for Qwen3-Embedding-8B).
// Scanning them all on every request blows the 10 ms CPU limit of the free
// plan, so each item also stores a compact vector: the full vector hashed down
// to 512 dims (count sketch, works for any model) and quantized to int8
// (512 bytes). Scans run over compact vectors, then a short list is re-ranked
// with the exact full vectors. Measured on real data this keeps ~99% of the
// exact top-10 with a shortlist of 40.

export const COMPACT_DIMS = 512;
const SHORTLIST = 40;

type Blob = ArrayBuffer | ArrayLike<number>;

function toBytes(blob: Blob): Uint8Array {
  return blob instanceof ArrayBuffer ? new Uint8Array(blob) : Uint8Array.from(blob);
}

export function asFloat32(blob: Blob): Float32Array {
  const bytes = toBytes(blob);
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 2);
}

export function asInt8(blob: Blob): Int8Array {
  const bytes = toBytes(blob);
  return new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

// murmur3 finalizer: a fixed, well-mixed hash of the dimension index.
function mix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Count-sketch projection to COMPACT_DIMS, normalized and quantized to int8. */
export function compactVector(full: ArrayLike<number>): Int8Array {
  const out = new Float32Array(COMPACT_DIMS);
  for (let d = 0; d < full.length; d++) {
    const h = mix(d + 1);
    out[h % COMPACT_DIMS] += h & 0x80000000 ? -full[d] : full[d];
  }
  let max = 0;
  for (const x of out) max = Math.max(max, Math.abs(x));
  const q = new Int8Array(COMPACT_DIMS);
  if (max === 0) return q;
  for (let i = 0; i < COMPACT_DIMS; i++) q[i] = Math.round((out[i] / max) * 127);
  return q;
}

function norm(v: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s) || 1;
}

/** Cosine similarity; returns -1 when the dimensions differ. */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>, na = norm(a), nb = norm(b)): number {
  if (a.length !== b.length) return -1;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot / (na * nb);
}

/** Column values to store for a freshly computed embedding. */
export function vectorColumns(full: number[]) {
  return {
    embedding: new Uint8Array(new Float32Array(full).buffer),
    vec: new Uint8Array(compactVector(full).buffer),
  };
}

interface CompactRow {
  id: number;
  vec: Blob;
}

async function loadFull(db: D1Database, ids: number[]): Promise<Map<number, Float32Array>> {
  if (!ids.length) return new Map();
  const { results } = await db
    .prepare(`SELECT id, embedding FROM items WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(...ids)
    .all<{ id: number; embedding: Blob | null }>();
  return new Map(results.filter((r) => r.embedding).map((r) => [r.id, asFloat32(r.embedding!)]));
}

/**
 * Items most similar to `query`, among those embedded with `model`.
 * Two stages: compact scan over everything, exact re-rank of a shortlist.
 */
export async function nearest(
  db: D1Database,
  query: ArrayLike<number>,
  model: string,
  opts: { limit: number; excludeId?: number; minScore?: number },
): Promise<{ id: number; score: number }[]> {
  const { results } = await db
    .prepare(
      "SELECT id, vec FROM items WHERE vec IS NOT NULL AND deleted_at IS NULL AND embedding_model = ? AND id != ?",
    )
    .bind(model, opts.excludeId ?? -1)
    .all<CompactRow>();
  const q = compactVector(query);
  const nq = norm(q);
  const shortlist = results
    .map((r) => {
      const v = asInt8(r.vec);
      return { id: r.id, score: cosine(q, v, nq) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(SHORTLIST, opts.limit));

  const full = await loadFull(db, shortlist.map((s) => s.id));
  const nFull = norm(query);
  return shortlist
    .flatMap((s) => {
      const v = full.get(s.id);
      return v ? [{ id: s.id, score: cosine(query, v, nFull) }] : [];
    })
    .filter((s) => s.score >= (opts.minScore ?? -1))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit);
}

/**
 * Groups of near-identical items within the same category. Pairs are screened
 * with compact vectors, then confirmed with the full vectors.
 */
export async function similarGroups(
  db: D1Database,
  model: string,
  exclude: Set<number>,
  threshold = 0.92,
  screen = 0.85,
): Promise<number[][]> {
  const { results } = await db
    .prepare(
      "SELECT id, category, vec FROM items WHERE vec IS NOT NULL AND deleted_at IS NULL AND embedding_model = ?",
    )
    .bind(model)
    .all<CompactRow & { category: string }>();

  const byCategory = new Map<string, { id: number; v: Int8Array; n: number }[]>();
  for (const r of results) {
    if (exclude.has(r.id)) continue;
    const v = asInt8(r.vec);
    const list = byCategory.get(r.category) ?? [];
    list.push({ id: r.id, v, n: norm(v) });
    byCategory.set(r.category, list);
  }

  const candidates: [number, number][] = [];
  for (const list of byCategory.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (cosine(a.v, b.v, a.n, b.n) > screen) candidates.push([a.id, b.id]);
      }
    }
  }
  if (!candidates.length) return [];

  const full = await loadFull(db, [...new Set(candidates.flat())].slice(0, 200));
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    while (parent.has(x) && parent.get(x) !== x) x = parent.get(x)!;
    return x;
  };
  for (const [a, b] of candidates) {
    const va = full.get(a);
    const vb = full.get(b);
    if (!va || !vb || cosine(va, vb) <= threshold) continue;
    parent.set(a, parent.get(a) ?? a);
    parent.set(b, parent.get(b) ?? b);
    parent.set(find(a), find(b));
  }
  const groups = new Map<number, number[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    groups.set(root, [...(groups.get(root) ?? []), id]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Fills in compact vectors for embeddings stored before they existed. */
export async function backfillCompactVectors(db: D1Database, limit = 40): Promise<number> {
  const { results } = await db
    .prepare("SELECT id, embedding FROM items WHERE embedding IS NOT NULL AND vec IS NULL LIMIT ?")
    .bind(limit)
    .all<{ id: number; embedding: Blob }>();
  if (!results.length) return 0;
  await db.batch(
    results.map((r) =>
      db
        .prepare("UPDATE items SET vec = ? WHERE id = ?")
        .bind(new Uint8Array(compactVector(asFloat32(r.embedding)).buffer), r.id),
    ),
  );
  return results.length;
}
