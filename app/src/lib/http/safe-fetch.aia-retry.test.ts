import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLookup, mockFetch, mockChase } = vi.hoisted(() => ({
  mockLookup: vi.fn(),
  mockFetch: vi.fn(),
  mockChase: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  lookup: mockLookup,
  default: { lookup: mockLookup },
}));

// Keep Agent/buildConnector real (so dispatchers are genuine objects we can
// compare by identity); only fetch is faked.
vi.mock("undici", async (importOriginal) => {
  const actual = await importOriginal<typeof import("undici")>();
  return { ...actual, fetch: mockFetch };
});

// Keep isCertChainError real; only the network-touching walk is stubbed, so no
// real TLS probe runs and we drive completion outcomes directly.
vi.mock("./aia", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./aia")>();
  return { ...actual, chaseAiaChain: mockChase };
});

import { AIA_INTERMEDIATE_YR1_PEM } from "./__fixtures__/aia-certs";
import { safeFetch } from "./safe-fetch";

/** The undici error shape for an incomplete cert chain (real code on the cause). */
function chainError(): TypeError {
  return new TypeError("fetch failed", {
    cause: Object.assign(new Error("leaf"), {
      code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    }),
  });
}

function ok(body = "<html></html>"): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html" },
  });
}

function redirectTo(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

/** The dispatcher passed to the Nth undici fetch call. */
function dispatcherOfCall(n: number): unknown {
  return mockFetch.mock.calls[n]?.[1]?.dispatcher;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  mockChase.mockResolvedValue([]); // completion finds nothing unless overridden
  mockFetch.mockResolvedValue(ok());
});

describe("safeFetch AIA retry", () => {
  it("retries with the completed chain and succeeds", async () => {
    mockFetch.mockRejectedValueOnce(chainError()).mockResolvedValueOnce(ok());
    mockChase.mockResolvedValueOnce([AIA_INTERMEDIATE_YR1_PEM]);

    const res = await safeFetch("https://retry.example/");

    expect(res.status).toBe(200);
    expect(mockChase).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("propagates the original error when completion finds nothing", async () => {
    mockFetch.mockRejectedValue(chainError());
    mockChase.mockResolvedValueOnce([]);

    await expect(safeFetch("https://nochain.example/")).rejects.toThrow(
      "fetch failed",
    );
    expect(mockFetch).toHaveBeenCalledTimes(1); // no retry without a completion
  });

  it("does not attempt AIA for non-chain failures", async () => {
    mockFetch.mockRejectedValue(
      Object.assign(new Error("boom"), { code: "ETIMEDOUT" }),
    );

    await expect(safeFetch("https://timeout.example/")).rejects.toThrow("boom");
    expect(mockChase).not.toHaveBeenCalled();
  });

  it("evicts the cached chain on a failed retry so the next call re-chases", async () => {
    const host = "https://rotates.example/";
    // Call 1: default fails, completion succeeds, retry still fails → evict.
    mockFetch
      .mockRejectedValueOnce(chainError()) // call 1 default
      .mockRejectedValueOnce(chainError()) // call 1 retry (stale) → evict
      .mockRejectedValueOnce(chainError()) // call 2 default
      .mockResolvedValueOnce(ok()); // call 2 retry succeeds
    mockChase.mockResolvedValue([AIA_INTERMEDIATE_YR1_PEM]);

    await expect(safeFetch(host)).rejects.toThrow("fetch failed");
    const res = await safeFetch(host);

    expect(res.status).toBe(200);
    // Re-chased on the second call — proves the stale entry was evicted, not
    // returned from cache (which would leave chase count at 1).
    expect(mockChase).toHaveBeenCalledTimes(2);
  });

  it("uses a per-host dispatcher across a redirect to another host", async () => {
    // hostA: default fails → complete → retry redirects to hostB → hostB ok.
    mockFetch
      .mockRejectedValueOnce(chainError()) // hostA default
      .mockResolvedValueOnce(redirectTo("https://b.example/")) // hostA retry
      .mockResolvedValueOnce(ok()); // hostB
    mockChase.mockResolvedValueOnce([AIA_INTERMEDIATE_YR1_PEM]);

    const res = await safeFetch("https://a.example/");

    expect(res.status).toBe(200);
    expect(res.url).toBe("https://b.example/");
    // hostA's retry used its AIA-completed agent; hostB must not inherit it.
    expect(dispatcherOfCall(2)).not.toBe(dispatcherOfCall(1));
    // hostB falls back to the same default agent hostA started with.
    expect(dispatcherOfCall(2)).toBe(dispatcherOfCall(0));
  });
});
