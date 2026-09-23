import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// A D1Database stand-in backed by node:sqlite (SQLite with FTS5), so route
// tests run the real SQL against the real migrations.

type Row = Record<string, unknown>;

function toSqlite(v: unknown): SQLInputValue {
  if (v === undefined) throw new TypeError("D1_TYPE_ERROR: undefined is not a supported bind value");
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  return v as SQLInputValue;
}

/** D1 hands BLOBs back as ArrayBuffer. */
function fromSqlite(row: Row | undefined): Row | null {
  if (!row) return null;
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v;
  }
  return out;
}

class Statement {
  constructor(
    private db: TestD1,
    readonly sql: string,
    private params: SQLInputValue[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new Statement(this.db, this.sql, values.map(toSqlite));
  }

  private stmt() {
    return this.db.raw.prepare(this.sql);
  }

  async first<T = Row>(column?: string): Promise<T | null> {
    const row = fromSqlite(this.stmt().get(...this.params) as Row | undefined);
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async all<T = Row>() {
    const results = (this.stmt().all(...this.params) as Row[]).map((r) => fromSqlite(r)!) as T[];
    return { success: true, results, meta: this.db.meta(0, 0) };
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const s = this.stmt();
    s.setReturnArrays(true);
    return s.all(...this.params) as T[];
  }

  async run() {
    const r = this.stmt().run(...this.params);
    return {
      success: true,
      results: [],
      meta: this.db.meta(Number(r.changes), Number(r.lastInsertRowid)),
    };
  }
}

export class TestD1 {
  readonly raw = new DatabaseSync(":memory:");

  prepare(sql: string) {
    return new Statement(this, sql);
  }

  async batch(statements: Statement[]) {
    this.raw.exec("BEGIN");
    try {
      const out = [];
      for (const s of statements) {
        out.push(/^\s*(select|with)\b/i.test(s.sql) ? await s.all() : await s.run());
      }
      this.raw.exec("COMMIT");
      return out;
    } catch (err) {
      this.raw.exec("ROLLBACK");
      throw err;
    }
  }

  async exec(sql: string) {
    this.raw.exec(sql);
    return { count: 1, duration: 0 };
  }

  meta(changes: number, lastRowId: number) {
    const pages = this.raw.prepare("PRAGMA page_count").get() as { page_count: number };
    const size = this.raw.prepare("PRAGMA page_size").get() as { page_size: number };
    return {
      changes,
      last_row_id: lastRowId,
      changed_db: changes > 0,
      duration: 0,
      rows_read: 0,
      rows_written: changes,
      size_after: pages.page_count * size.page_size,
    };
  }
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");

/** A fresh in-memory database with every migration applied. */
export function createTestD1(): TestD1 {
  const db = new TestD1();
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    db.raw.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  return db;
}
