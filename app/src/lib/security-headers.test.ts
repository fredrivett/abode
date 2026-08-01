import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS, securityHeadersConfig } from "./security-headers";

// The exact set of hardening headers we expect on every route. CSP is
// intentionally excluded (planned follow-up) — asserted below.
const EXPECTED_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
  "X-DNS-Prefetch-Control": "on",
};

describe("SECURITY_HEADERS", () => {
  it("includes every expected header with the exact value", () => {
    const byKey = new Map(SECURITY_HEADERS.map((h) => [h.key, h.value]));
    for (const [key, value] of Object.entries(EXPECTED_HEADERS)) {
      expect(byKey.get(key)).toBe(value);
    }
  });

  it("has no duplicate header keys", () => {
    const keys = SECURITY_HEADERS.map((h) => h.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not set a Content-Security-Policy (deferred to a follow-up)", () => {
    const keys = SECURITY_HEADERS.map((h) => h.key.toLowerCase());
    expect(keys).not.toContain("content-security-policy");
    expect(keys).not.toContain("content-security-policy-report-only");
  });
});

describe("securityHeadersConfig", () => {
  it("applies the headers to a catch-all source matching every route", async () => {
    const config = await securityHeadersConfig();
    expect(config).toHaveLength(1);

    const [rule] = config;
    // `/:path*` is Next's catch-all matcher (also matches `/`)
    expect(rule.source).toBe("/:path*");
    expect(rule.headers).toEqual([...SECURITY_HEADERS]);
  });
});
