import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLookup } = vi.hoisted(() => ({ mockLookup: vi.fn() }));

// node:dns/promises exposes both named and default (namespace) exports.
vi.mock("node:dns/promises", () => ({
  lookup: mockLookup,
  default: { lookup: mockLookup },
}));

import {
  isBlockedIp,
  SafeFetchError,
  SsrfBlockedError,
  safeFetch,
} from "./safe-fetch";

const mockFetch = vi.fn();

/** Resolve every hostname to one public address unless a test overrides it. */
function resolveTo(address: string, family = address.includes(":") ? 6 : 4) {
  mockLookup.mockResolvedValue([{ address, family }]);
}

function redirectResponse(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

function streamResponse(chunks: Uint8Array[], init?: ResponseInit): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(body, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveTo("93.184.216.34"); // example.com, a public address
  mockFetch.mockResolvedValue(
    new Response("<html></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    }),
  );
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── IP classification ───────────────────────────────────────────────────────

describe("isBlockedIp — IPv4 blocked ranges", () => {
  it.each([
    ["0.0.0.0/8 (this host)", "0.0.0.0"],
    ["0.0.0.0/8 (other)", "0.1.2.3"],
    ["10/8 private (low)", "10.0.0.1"],
    ["10/8 private (high)", "10.255.255.255"],
    ["100.64/10 CGNAT (low)", "100.64.0.1"],
    ["100.64/10 CGNAT (high)", "100.127.255.255"],
    ["127/8 loopback", "127.0.0.1"],
    ["127/8 loopback (other)", "127.9.9.9"],
    ["169.254/16 metadata IP", "169.254.169.254"],
    ["169.254/16 link-local", "169.254.0.1"],
    ["172.16/12 private (low)", "172.16.0.1"],
    ["172.16/12 private (high)", "172.31.255.255"],
    ["192.168/16 private", "192.168.1.1"],
    ["224/4 multicast", "224.0.0.1"],
    ["239/8 multicast (high)", "239.255.255.255"],
    ["240/4 reserved", "240.0.0.1"],
    ["255.255.255.255 broadcast", "255.255.255.255"],
  ])("blocks %s", (_label, ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });
});

describe("isBlockedIp — public IPv4 is allowed", () => {
  it.each([
    ["Google DNS", "8.8.8.8"],
    ["Cloudflare DNS", "1.1.1.1"],
    ["example.com", "93.184.216.34"],
    ["just below CGNAT", "100.63.255.255"],
    ["just above CGNAT", "100.128.0.1"],
    ["just below 172.16/12", "172.15.255.255"],
    ["just above 172.16/12", "172.32.0.0"],
    ["just below 192.168", "192.167.255.255"],
    ["just above 192.168", "192.169.0.0"],
    ["just below multicast", "223.255.255.255"],
    ["11/8 public", "11.22.33.44"],
    ["128/8 public", "128.0.0.1"],
  ])("allows %s", (_label, ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });
});

describe("isBlockedIp — IPv6 blocked ranges", () => {
  it.each([
    ["loopback ::1", "::1"],
    ["unspecified ::", "::"],
    ["link-local fe80::/10", "fe80::1"],
    ["link-local febf::", "febf::1"],
    ["unique-local fc00::/7", "fc00::1"],
    ["unique-local fd00::/8", "fd12:3456:789a::1"],
    ["multicast ff00::/8", "ff02::1"],
    ["v4-mapped loopback", "::ffff:127.0.0.1"],
    ["v4-mapped private", "::ffff:10.0.0.1"],
    ["v4-mapped metadata", "::ffff:169.254.169.254"],
    ["v4-compatible loopback (deprecated)", "::127.0.0.1"],
  ])("blocks %s", (_label, ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });
});

describe("isBlockedIp — public IPv6 is allowed", () => {
  it.each([
    ["Cloudflare", "2606:4700:4700::1111"],
    ["Google DNS", "2001:4860:4860::8888"],
    ["v4-mapped PUBLIC address unwraps to allowed", "::ffff:8.8.8.8"],
  ])("allows %s", (_label, ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });
});

describe("isBlockedIp — v4-mapped IPv6 re-checks the embedded IPv4", () => {
  it("blocks a mapped private address but allows a mapped public one", () => {
    expect(isBlockedIp("::ffff:192.168.1.1")).toBe(true);
    expect(isBlockedIp("::ffff:8.8.8.8")).toBe(false);
  });
});

describe("isBlockedIp — fails closed on non-literals", () => {
  it("blocks a value that is not an IP literal", () => {
    expect(isBlockedIp("example.com")).toBe(true);
    expect(isBlockedIp("not-an-ip")).toBe(true);
    expect(isBlockedIp("")).toBe(true);
  });
});

// ── safeFetch ───────────────────────────────────────────────────────────────

describe("safeFetch — protocol allowlist", () => {
  it.each(["file:///etc/passwd", "gopher://x/", "ftp://example.com/"])(
    "rejects %s without touching the network",
    async (url) => {
      await expect(safeFetch(url)).rejects.toBeInstanceOf(SsrfBlockedError);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockLookup).not.toHaveBeenCalled();
    },
  );
});

describe("safeFetch — blocked destinations", () => {
  it("rejects a private IP-literal URL without a DNS lookup or fetch", async () => {
    await expect(
      safeFetch("http://169.254.169.254/latest/meta-data/"),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(mockLookup).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects a bracketed IPv6 loopback literal", async () => {
    await expect(safeFetch("http://[::1]/")).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects a hostname that resolves to a private address, without fetching", async () => {
    resolveTo("10.0.0.5");
    await expect(safeFetch("http://internal.corp/")).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
    expect(mockLookup).toHaveBeenCalledOnce();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects when ANY resolved address is private (mixed A records)", async () => {
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(safeFetch("http://rebind.example/")).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects an unresolvable host", async () => {
    mockLookup.mockResolvedValue([]);
    await expect(safeFetch("http://ghost.example/")).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("safeFetch — redirects", () => {
  it("re-validates a redirect hop and rejects a private target (one fetch)", async () => {
    mockFetch.mockResolvedValueOnce(
      redirectResponse("http://169.254.169.254/"),
    );
    await expect(safeFetch("https://example.com/")).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
    // Only the first hop is fetched; the blocked target never is.
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("follows a redirect to an allowed host after re-validating it", async () => {
    mockFetch
      .mockResolvedValueOnce(redirectResponse("https://example.com/final"))
      .mockResolvedValueOnce(
        new Response("ok", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      );
    const res = await safeFetch("https://example.com/start");
    expect(res.status).toBe(200);
    expect(res.url).toBe("https://example.com/final");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://example.com/final",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("rejects when the redirect chain is too long", async () => {
    mockFetch.mockResolvedValue(redirectResponse("https://example.com/next"));
    await expect(
      safeFetch("https://example.com/", { maxRedirects: 2 }),
    ).rejects.toBeInstanceOf(SafeFetchError);
    // initial hop + 2 allowed redirects = 3 fetches, then the 4th is refused
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

describe("safeFetch — body size cap", () => {
  it("rejects an over-cap Content-Length up front", async () => {
    mockFetch.mockResolvedValue(
      new Response("x", {
        status: 200,
        headers: { "content-length": String(20 * 1024 * 1024) },
      }),
    );
    await expect(
      safeFetch("https://example.com/", { maxBytes: 1024 }),
    ).rejects.toMatchObject({ code: "body_too_large" });
  });

  it("aborts a body that streams past the cap (no Content-Length)", async () => {
    const big = new Uint8Array(4096);
    mockFetch.mockResolvedValue(
      streamResponse([big, big, big], {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    );
    const res = await safeFetch("https://example.com/", { maxBytes: 5000 });
    // Headers arrive fine; the cap fires while reading the body.
    await expect(res.arrayBuffer()).rejects.toMatchObject({
      code: "body_too_large",
    });
  });

  it("does not reject a HEAD with an over-cap Content-Length (no body transferred)", async () => {
    mockFetch.mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "content-length": String(999 * 1024 * 1024) },
      }),
    );
    const res = await safeFetch("https://example.com/", { method: "HEAD" });
    expect(res.status).toBe(200);
  });
});

describe("safeFetch — allowed request", () => {
  it("fetches a public URL manually (no auto-redirect) and returns the body", async () => {
    mockFetch.mockResolvedValue(
      new Response("hello world", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
    const res = await safeFetch("https://example.com/page");

    expect(res.ok).toBe(true);
    expect(res.headers.get("content-type")).toBe("text/plain");
    expect(res.url).toBe("https://example.com/page");
    await expect(res.text()).resolves.toBe("hello world");

    expect(mockLookup).toHaveBeenCalledWith(
      "example.com",
      expect.objectContaining({ all: true }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/page",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("forwards caller method and headers to the upstream", async () => {
    await safeFetch("https://example.com/", {
      method: "HEAD",
      headers: { "User-Agent": "AbodeBot/1.0" },
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/",
      expect.objectContaining({
        method: "HEAD",
        headers: { "User-Agent": "AbodeBot/1.0" },
      }),
    );
  });

  it("passes an abort signal so the request is time-bounded", async () => {
    await safeFetch("https://example.com/");
    const init = mockFetch.mock.calls[0][1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
