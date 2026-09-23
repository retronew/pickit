import { describe, expect, it } from "vitest";
import { getJob, retryFailures, setJobStatus, startJob, stepJob } from "./jobs";

/** Just enough of D1 for the settings-table queries used by jobs.ts. */
function fakeDb() {
  const rows = new Map<string, string>();
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          args = a;
          return stmt;
        },
        async first<T>() {
          const value = rows.get(args[0] as string);
          return (value === undefined ? null : { value }) as T;
        },
        async run() {
          if (sql.startsWith("INSERT")) {
            rows.set(args[0] as string, args[1] as string);
            return { meta: { changes: 1 } };
          }
          // UPDATE settings SET value = ? WHERE key = ? AND value = ?
          const [value, key, expected] = args as string[];
          if (rows.get(key) !== expected) return { meta: { changes: 0 } };
          rows.set(key, value);
          return { meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };
  return db as unknown as D1Database;
}

describe("batch jobs", () => {
  it("processes in batches until done", async () => {
    const db = fakeDb();
    await startJob(db, "reembed", "all", [1, 2, 3, 4, 5]);
    const seen: number[][] = [];
    let job = await getJob(db, "reembed");
    while (job.status === "running") {
      job = await stepJob(db, "reembed", 2, async (ids) => {
        seen.push(ids);
        return {
          doneIds: ids.filter((id) => id !== 4),
          failures: ids.includes(4) ? [{ id: 4, name: "four", error: "boom" }] : [],
        };
      });
    }
    expect(seen).toEqual([[1, 2], [3, 4], [5]]);
    expect(job).toMatchObject({ status: "done", done: 4, pendingIds: [], lastError: "boom" });
    expect(job.failures).toEqual([{ id: 4, name: "four", error: "boom" }]);
  });

  it("pauses with the reason when a whole batch throws, keeping it pending", async () => {
    const db = fakeDb();
    await startJob(db, "organize", "all", [1, 2]);
    const job = await stepJob(db, "organize", 2, async () => {
      throw new Error("401 invalid key");
    });
    expect(job).toMatchObject({ status: "paused", lastError: "401 invalid key", pendingIds: [1, 2] });
    const resumed = await setJobStatus(db, "organize", "running");
    expect(resumed).toMatchObject({ status: "running", lastError: undefined });
  });

  it("keeps a pause requested while a step is in flight", async () => {
    const db = fakeDb();
    await startJob(db, "reembed", "all", [1, 2, 3]);
    const job = await stepJob(db, "reembed", 1, async (ids) => {
      await setJobStatus(db, "reembed", "paused");
      return { doneIds: ids, failures: [] };
    });
    expect(job).toMatchObject({ status: "paused", done: 1, pendingIds: [2, 3] });
  });

  it("lets only one driver process a batch at a time", async () => {
    const db = fakeDb();
    await startJob(db, "reembed", "all", [1, 2]);
    let calls = 0;
    const slow = async (ids: number[]) => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return { doneIds: ids, failures: [] };
    };
    await Promise.all([stepJob(db, "reembed", 1, slow), stepJob(db, "reembed", 1, slow)]);
    expect(calls).toBe(1);
  });

  it("re-queues failed items on retry", async () => {
    const db = fakeDb();
    await startJob(db, "reembed", "all", [1, 2]);
    await stepJob(db, "reembed", 2, async () => ({
      doneIds: [1],
      failures: [{ id: 2, name: "two", error: "x" }],
    }));
    const job = await retryFailures(db, "reembed");
    expect(job).toMatchObject({ status: "running", pendingIds: [2], failures: [], total: 2 });
  });
});
