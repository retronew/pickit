import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { batches, mergeCatalog, missingKeys, placeholders, rejectDraft } from "./i18n-tools";

describe("i18n tools", () => {
  it("finds missing or empty keys, ignoring $schema", () => {
    expect(missingKeys({ $schema: "s", a: "甲", b: "乙", c: "丙" }, { a: "A", b: " " })).toEqual(["b", "c"]);
  });

  it("rejects drafts that change placeholders or are empty", () => {
    expect(placeholders("共 {count} 条，{ name }")).toEqual(["count", "name"]);
    expect(rejectDraft("共 {count} 条", "{count} items")).toBeNull();
    expect(rejectDraft("共 {count} 条", "{n} items")).toMatch(/placeholders/);
    expect(rejectDraft("你好", "")).toBe("empty");
    expect(rejectDraft("你好", 42)).toBe("empty");
  });

  it("batches and merges with sorted keys and $schema first", () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(Object.keys(mergeCatalog({ $schema: "s", b: "B" }, { a: "A" }))).toEqual(["$schema", "a", "b"]);
  });
});

describe("translate-messages script", () => {
  it("drafts missing keys with an OpenAI-compatible API and skips bad drafts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pickit-i18n-"));
    writeFileSync(join(dir, "zh.json"), JSON.stringify({ $schema: "s", hello: "你好", count: "共 {count} 条", done: "完成" }));
    writeFileSync(join(dir, "en.json"), JSON.stringify({ $schema: "s", done: "Done" }));

    const requests: unknown[] = [];
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        requests.push({ auth: req.headers.authorization, body: JSON.parse(body) });
        // "count" loses its placeholder, so it must be skipped.
        const content = JSON.stringify({ hello: "Hello", count: "Some items" });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ choices: [{ message: { content } }] }));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;

    const script = join(dirname(fileURLToPath(import.meta.url)), "../scripts/translate-messages.ts");
    const run = promisify(execFile)(process.execPath, [script, "--messages", dir, "--locale", "en"], {
      env: { ...process.env, I18N_AI_BASE_URL: `http://127.0.0.1:${port}/v1/`, I18N_AI_KEY: "k", I18N_AI_MODEL: "m" },
    });
    const outcome = await run.then(
      (r) => ({ code: 0, out: r.stdout + r.stderr }),
      (e) => ({ code: e.code as number, out: `${e.stdout}${e.stderr}` }),
    );
    server.close();

    expect(outcome.code).toBe(1);
    expect(outcome.out).toContain("skipped count");
    const en = JSON.parse(readFileSync(join(dir, "en.json"), "utf8"));
    expect(en).toEqual({ $schema: "s", done: "Done", hello: "Hello" });
    expect(requests).toHaveLength(1);
    const [{ auth, body }] = requests as { auth: string; body: any }[];
    expect(auth).toBe("Bearer k");
    expect(JSON.parse(body.messages[1].content)).toEqual({ hello: "你好", count: "共 {count} 条" });
    expect(body.messages[0].content).toContain("into English");
  });
});
