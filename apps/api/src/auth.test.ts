import { describe, expect, it } from "vitest";
import { allowedEmails, enabledProviders, isAllowedEmail } from "./auth";
import type { Env } from "./types";

const env = (vars: Partial<Env>) => vars as Env;

describe("email allowlist", () => {
  it("parses comma / whitespace separated emails case-insensitively", () => {
    const e = env({ ALLOWED_EMAILS: " Me@Example.com, other@x.io\nthird@y.dev " });
    expect([...allowedEmails(e)]).toEqual(["me@example.com", "other@x.io", "third@y.dev"]);
    expect(isAllowedEmail(e, "ME@example.COM")).toBe(true);
    expect(isAllowedEmail(e, "stranger@example.com")).toBe(false);
  });

  it("rejects everyone when the allowlist is empty or the email is missing", () => {
    expect(isAllowedEmail(env({}), "me@example.com")).toBe(false);
    expect(isAllowedEmail(env({ ALLOWED_EMAILS: "me@example.com" }), null)).toBe(false);
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
