import { describe, expect, it } from "vitest";
import { isValidHost } from "#favicons";

describe("isValidHost", () => {
  it("accepts ordinary and punycoded hostnames", () => {
    for (const host of ["github.com", "a.b-c.example.co.uk", "xn--fiqs8s.xn--fiqz9s"]) {
      expect(isValidHost(host), host).toBe(true);
    }
  });

  it("rejects anything that isn't a plain hostname", () => {
    for (const host of ["localhost", "-a.com", "a-.com", "a..com", "a.com/x", "a.com?x=1", "a com.b", "", "1.2.3.4:80"]) {
      expect(isValidHost(host), host).toBe(false);
    }
  });
});
