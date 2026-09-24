import { vi } from "vitest";

/**
 * Answers every outgoing request with 200, so code that checks links (the
 * daily cron) runs offline and fast. Pair with vi.unstubAllGlobals().
 */
export function stubLinksReachable() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 200 })),
  );
}
