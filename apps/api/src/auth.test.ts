import { describe, expect, it } from "vitest";
import { enabledProviders, isAllowedEmail, isValidEmail, ownerEmails, parseEmails } from "./auth";
import type { Env } from "./types";

/** Minimal D1 stand-in holding the `allowed_emails` settings row. */
function fakeDb(extra: string[] | null) {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => (extra ? { value: JSON.stringify(extra) } : null),
      }),
    }),
  } as unknown as D1Database;
}

const env = (vars: Partial<Env>, extra: string[] | null = null) =>
  ({ DB: fakeDb(extra), ...vars }) as Env;

describe("email allowlist", () => {
  it("parses comma / whitespace separated emails case-insensitively", () => {
    expect(parseEmails(" Me@Example.com, other@x.io\nthird@y.dev me@example.com")).toEqual([
      "me@example.com",
      "other@x.io",
      "third@y.dev",
    ]);
    expect(ownerEmails(env({ ALLOWED_EMAILS: "A@b.co" }))).toEqual(["a@b.co"]);
  });

  it("allows owners and the extra emails from settings", async () => {
    const e = env({ ALLOWED_EMAILS: "me@example.com" }, ["friend@example.com"]);
    expect(await isAllowedEmail(e, "ME@example.COM")).toBe(true);
    expect(await isAllowedEmail(e, "Friend@example.com")).toBe(true);
    expect(await isAllowedEmail(e, "stranger@example.com")).toBe(false);
  });

  it("rejects everyone when both lists are empty or the email is missing", async () => {
    expect(await isAllowedEmail(env({}), "me@example.com")).toBe(false);
    expect(await isAllowedEmail(env({ ALLOWED_EMAILS: "me@example.com" }), null)).toBe(false);
  });

  it("validates email format", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("enabledProviders", () => {
  it("only lists providers with both client id and secret", () => {
    expect(
      enabledProviders(
        env({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s", GITHUB_CLIENT_ID: "id" }),
      ),
    ).toEqual(["google"]);
  });
});
