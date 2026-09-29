import { describe, expect, it, vi } from "vitest";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { fallbackModel } from "./ai-fallback";

function fakeModel(id: string, fail: boolean): LanguageModelV4 {
  const run = vi.fn(async () => {
    if (fail) throw new Error(`${id} down`);
    return { id } as never;
  });
  return { specificationVersion: "v4", provider: "p", modelId: id, supportedUrls: {}, doGenerate: run, doStream: run };
}

describe("fallbackModel", () => {
  it("uses the next model when one fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const [a, b, c] = [fakeModel("a", true), fakeModel("b", false), fakeModel("c", false)];
    const model = fallbackModel([a, b, c]);
    await expect(model.doGenerate({} as never)).resolves.toEqual({ id: "b" });
    await expect(model.doStream({} as never)).resolves.toEqual({ id: "b" });
    expect(c.doGenerate).not.toHaveBeenCalled();
  });

  it("throws the last error when every model fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const model = fallbackModel([fakeModel("a", true), fakeModel("b", true)]);
    await expect(model.doGenerate({} as never)).rejects.toThrow("b down");
  });

  it("doesn't try another model after the call is aborted", async () => {
    const b = fakeModel("b", false);
    const controller = new AbortController();
    controller.abort();
    const model = fallbackModel([fakeModel("a", true), b]);
    await expect(model.doGenerate({ abortSignal: controller.signal } as never)).rejects.toThrow("a down");
    expect(b.doGenerate).not.toHaveBeenCalled();
  });
});
