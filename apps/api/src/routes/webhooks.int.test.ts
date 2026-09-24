import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, type TestApp } from "../test/app";
import { sign } from "#webhooks";

let t: TestApp;
let sent: { url: string; headers: Record<string, string>; body: string }[];

beforeEach(async () => {
  t = await createTestApp();
  sent = [];
  // Only the webhook endpoints are faked; the rest of the tests never hit the network.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    sent.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()), body: String(init?.body) });
    return new Response(url.includes("broken") ? "nope" : "ok", { status: url.includes("broken") ? 500 : 200 });
  });
});

afterEach(() => vi.restoreAllMocks());

const events = () => sent.map((s) => JSON.parse(s.body).event);

describe("webhooks", () => {
  it("creates a webhook, showing its secret once", async () => {
    const hook = await t.json("/api/webhooks", { json: { url: "https://hooks.test/a", events: ["item.created"] } }, 201);
    expect(hook).toMatchObject({ url: "https://hooks.test/a", events: ["item.created"], enabled: true });
    expect(hook.secret).toMatch(/^[0-9a-f]{48}$/);
    expect((await t.json("/api/webhooks"))[0]).not.toHaveProperty("secret");

    await t.json("/api/webhooks", { json: { url: "ftp://x", events: ["item.created"] } }, 400);
    await t.json("/api/webhooks", { json: { url: "https://hooks.test/a", events: ["nope"] } }, 400);
  });

  it("sends signed events only to enabled, subscribed webhooks", async () => {
    const hook = await t.json("/api/webhooks", { json: { url: "https://hooks.test/a", events: ["item.created", "item.deleted"] } }, 201);
    await t.json("/api/webhooks", { json: { url: "https://hooks.test/b", events: ["item.updated"] } }, 201);

    const { id } = await t.json("/api/items", { json: { name: "A", url: "https://a.dev", tags: ["x"] } }, 201);
    expect(sent.map((s) => s.url)).toEqual(["https://hooks.test/a"]);
    const payload = JSON.parse(sent[0].body);
    expect(payload).toMatchObject({ event: "item.created", data: { id, name: "A", url: "https://a.dev", tags: ["x"] } });
    expect(sent[0].headers["x-pickit-event"]).toBe("item.created");
    expect(sent[0].headers["x-pickit-signature"]).toBe(`sha256=${await sign(hook.secret, sent[0].body)}`);

    await t.json(`/api/items/${id}`, { method: "PUT", json: { name: "B" } });
    await t.json(`/api/items/${id}`, { method: "DELETE" });
    expect(events()).toEqual(["item.created", "item.updated", "item.deleted"]);

    // Disabled webhooks get nothing.
    sent = [];
    await t.json(`/api/webhooks/${hook.id}`, { method: "PATCH", json: { enabled: false } });
    await t.json("/api/items", { json: { name: "C", url: "https://c.dev" } }, 201);
    expect(sent).toEqual([]);
  });

  it("records the last delivery and sends a test ping", async () => {
    const hook = await t.json("/api/webhooks", { json: { url: "https://hooks.test/broken", events: ["item.created"] } }, 201);
    expect(await t.json(`/api/webhooks/${hook.id}/test`, { json: {} })).toMatchObject({ ok: false, status: 500, error: "nope" });
    expect(events()).toEqual(["ping"]);
    expect((await t.json("/api/webhooks"))[0]).toMatchObject({ lastStatus: 500, lastError: "nope", lastAt: expect.any(Number) });

    await t.json(`/api/webhooks/${hook.id}`, { method: "DELETE" });
    expect(await t.json("/api/webhooks")).toEqual([]);
    await t.json(`/api/webhooks/${hook.id}/test`, { json: {} }, 404);
  });
});
