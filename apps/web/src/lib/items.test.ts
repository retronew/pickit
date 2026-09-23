import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const confirm = vi.fn();
vi.mock("#components/Confirm", () => ({ Confirm: { call: (...a: unknown[]) => confirm(...a) } }));
vi.mock("#components/ui/toast", () => ({ toastManager: { add: vi.fn() } }));

const { saveItem } = await import("./items");
const { toastManager } = await import("#components/ui/toast");

const payload = { name: "Vite", url: "https://vite.dev", icon: "", note: "", category: "", tags: [] };
const calls: { url: string; method?: string; body: unknown }[] = [];

function respond(...responses: Response[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method, body: init.body ? JSON.parse(String(init.body)) : undefined });
      return responses.shift()!;
    }),
  );
}

beforeEach(() => {
  calls.length = 0;
  confirm.mockReset();
  vi.mocked(toastManager.add).mockClear();
});

afterEach(() => vi.unstubAllGlobals());

describe("saveItem", () => {
  it("creates a new item and shows a success toast", async () => {
    respond(Response.json({ id: 1 }, { status: 201 }));
    expect(await saveItem(payload, null)).toBe(true);
    expect(calls).toEqual([{ url: "/api/items", method: "POST", body: payload }]);
    expect(toastManager.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: "已添加收藏", type: "success" }),
    );
  });

  it("updates an existing item", async () => {
    respond(Response.json({ ok: true }));
    await saveItem(payload, { id: 7 } as never);
    expect(calls[0]).toMatchObject({ url: "/api/items/7", method: "PUT" });
  });

  it("asks before saving a duplicate and retries with allowDuplicate", async () => {
    respond(
      Response.json({ error: "duplicate", existing: { name: "旧的" } }, { status: 409 }),
      Response.json({ id: 2 }, { status: 201 }),
    );
    confirm.mockResolvedValue(true);
    expect(await saveItem(payload, null)).toBe(true);
    expect(confirm.mock.calls[0][0].message).toContain("旧的");
    expect(calls[1].body).toEqual({ ...payload, allowDuplicate: true });
  });

  it("returns false without saving when the duplicate is declined", async () => {
    respond(Response.json({ error: "duplicate", existing: {} }, { status: 409 }));
    confirm.mockResolvedValue(false);
    expect(await saveItem(payload, null)).toBe(false);
    expect(calls).toHaveLength(1);
    expect(toastManager.add).not.toHaveBeenCalled();
  });

  it("throws other errors so the dialog stays open", async () => {
    respond(Response.json({ error: "name required" }, { status: 400 }));
    await expect(saveItem(payload, null)).rejects.toMatchObject({ message: "name required" });
  });
});
