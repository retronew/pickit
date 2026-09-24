import { describe, expect, it } from "vitest";
import { activityLevel, parseProjectUrl, type ProjectActivity } from "./activity";

describe("parseProjectUrl", () => {
  it("finds GitHub repositories, ignoring sub-paths and non-repo pages", () => {
    expect(parseProjectUrl("https://github.com/Tresjs/tres")).toEqual({ source: "github", owner: "Tresjs", repo: "tres" });
    expect(parseProjectUrl("https://www.github.com/a/b.git/tree/main/src")).toEqual({ source: "github", owner: "a", repo: "b" });
    expect(parseProjectUrl("https://github.com/topics/react")).toBeNull();
    expect(parseProjectUrl("https://github.com/vercel")).toBeNull();
  });

  it("finds npm packages, scoped or not", () => {
    expect(parseProjectUrl("https://www.npmjs.com/package/react")).toEqual({ source: "npm", name: "react" });
    expect(parseProjectUrl("https://npmjs.com/package/@dnd-kit/core/v/6.0.0")).toEqual({ source: "npm", name: "@dnd-kit/core" });
    expect(parseProjectUrl("https://www.npmjs.com/search?q=x")).toBeNull();
    expect(parseProjectUrl("not a url")).toBeNull();
  });
});

describe("activityLevel", () => {
  const now = Date.UTC(2026, 8, 24);
  const days = (n: number) => now - n * 24 * 60 * 60 * 1000;
  const a = (patch: Partial<ProjectActivity>): ProjectActivity => ({ source: "github", checkedAt: now, lastActivityAt: null, ...patch });

  it("grades by time since the last activity", () => {
    expect(activityLevel(a({ lastActivityAt: days(10) }), now)).toBe("active");
    expect(activityLevel(a({ lastActivityAt: days(200) }), now)).toBe("slowing");
    expect(activityLevel(a({ lastActivityAt: days(400) }), now)).toBe("stale");
  });

  it("puts archived repos and deprecated packages first; unknown is null", () => {
    expect(activityLevel(a({ lastActivityAt: days(1), archived: true }), now)).toBe("archived");
    expect(activityLevel(a({ source: "npm", deprecated: true }), now)).toBe("archived");
    expect(activityLevel(a({}), now)).toBeNull();
    expect(activityLevel(null, now)).toBeNull();
  });
});
