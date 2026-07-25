import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/url", () => ({
  getAppBaseUrl: () => "https://www.abode.fyi",
}));

import { corsHeaders, preflight, withCors } from "./cors";

function request(origin?: string) {
  return {
    headers: {
      get: (key: string) =>
        key.toLowerCase() === "origin" ? (origin ?? null) : null,
    },
  } as unknown as Parameters<typeof corsHeaders>[0];
}

describe("corsHeaders", () => {
  it("reflects a chrome-extension origin", () => {
    const headers = corsHeaders(request("chrome-extension://abcdef"));
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "chrome-extension://abcdef",
    );
  });

  it("reflects a moz-extension origin", () => {
    const headers = corsHeaders(request("moz-extension://abcdef"));
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "moz-extension://abcdef",
    );
  });

  it("reflects the app's own origin", () => {
    const headers = corsHeaders(request("https://www.abode.fyi"));
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://www.abode.fyi",
    );
  });

  it("does not reflect an arbitrary web origin", () => {
    const headers = corsHeaders(request("https://evil.example.com"));
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("omits the allow-origin header when there is no Origin", () => {
    const headers = corsHeaders(request());
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("always advertises the allowed methods and headers, and varies on Origin", () => {
    const headers = corsHeaders(request("chrome-extension://abcdef"));
    expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
    expect(headers["Access-Control-Allow-Headers"]).toBe(
      "Authorization, Content-Type",
    );
    expect(headers.Vary).toBe("Origin");
  });

  it("never allows credentials (bearer-only, no ambient cookies)", () => {
    const headers = corsHeaders(request("chrome-extension://abcdef"));
    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
  });
});

describe("preflight", () => {
  it("returns a 204 with CORS headers", () => {
    const res = preflight(request("chrome-extension://abcdef"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "chrome-extension://abcdef",
    );
  });
});

describe("withCors", () => {
  it("attaches CORS headers to an existing response", () => {
    const res = withCors(
      request("chrome-extension://abcdef"),
      NextResponse.json({ ok: true }, { status: 201 }),
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "chrome-extension://abcdef",
    );
  });
});
