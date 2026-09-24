import { describe, expect, it } from "vitest";
import { parseUserAgent } from "./user-agent";

describe("parseUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0",
      { browser: "Microsoft Edge", os: "Windows", device: "desktop" },
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      { browser: "Chrome", os: "macOS", device: "desktop" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
      { browser: "Chrome", os: "Android", device: "mobile" },
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      { browser: "Safari", os: "iOS", device: "tablet" },
    ],
    ["", { browser: "", os: "", device: "" }],
  ])("%s", (ua, expected) => {
    expect(parseUserAgent(ua)).toEqual(expected);
  });
});
