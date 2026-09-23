import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, errorMessage } from "./api";

function mockFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("GETs by default and POSTs JSON when a body is given", async () => {
    const fetch = mockFetch(async () => Response.json({ ok: 1 }));
    expect(await api("/a")).toEqual({ ok: 1 });
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "GET", body: undefined });

    await api("/b", { json: { x: 1 } });
    expect(fetch.mock.calls[1][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ x: 1 }),
      headers: { "Content-Type": "application/json" },
    });

    await api("/c", { method: "PUT", json: {} });
    expect(fetch.mock.calls[2][1]).toMatchObject({ method: "PUT" });
  });

  it("throws the server's error message with status and data", async () => {
    mockFetch(async () => Response.json({ error: "重复了", existing: { id: 3 } }, { status: 409 }));
    const err = await api("/x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ message: "重复了", status: 409, data: { existing: { id: 3 } } });
  });

  it("falls back to the status code when there is no JSON error", async () => {
    mockFetch(async () => new Response("<html>oops</html>", { status: 503 }));
    await expect(api("/x")).rejects.toMatchObject({ message: "请求失败（503）", status: 503 });
  });

  it("reports network failures as status 0", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(api("/x")).rejects.toMatchObject({ status: 0, message: "网络出问题了，请重试" });
  });

  it("returns an empty object for empty successful responses", async () => {
    mockFetch(async () => new Response(null, { status: 204 }));
    expect(await api("/x")).toEqual({});
  });
});

describe("errorMessage", () => {
  it("prefers ApiError / Error messages", () => {
    expect(errorMessage(new ApiError("boom", 500))).toBe("boom");
    expect(errorMessage(new Error("bad"))).toBe("bad");
    expect(errorMessage("??")).toBe("出了点问题，请重试");
  });
});
