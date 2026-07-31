import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/**
 * These run against real undici, a real connector and a real socket — only
 * `safeFetch`'s own pre-flight is faked, so what blocks (or connects) here is
 * the dispatcher. `node:dns/promises` answers "public" for every host, which is
 * the DNS-rebinding shape; `isIP` answers "not an address" so an IP-literal URL
 * takes the same pre-flight path. undici is externalised in vitest, so both
 * mocks apply to `safe-fetch.ts` alone, not to the connection.
 */
const { mockLookup, mockIsIP } = vi.hoisted(() => ({
  mockLookup: vi.fn(),
  mockIsIP: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  lookup: mockLookup,
  default: { lookup: mockLookup },
}));

vi.mock("node:net", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:net")>();
  const patched = { ...actual, isIP: mockIsIP };
  return { ...patched, default: patched };
});

import { SsrfBlockedError, safeFetch } from "./safe-fetch";

let server: Server;
let port: number;
let requestPaths: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    requestPaths.push(req.url ?? "");
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("reached the private service");
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  requestPaths = [];
  mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  mockIsIP.mockReturnValue(0);
});

describe("safeFetch — connect-time gate (real undici)", () => {
  it("refuses a host that resolves privately even though the pre-check passed", async () => {
    const error = await safeFetch(`http://localhost:${port}/secret`, {
      timeoutMs: 5000,
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(SsrfBlockedError);
    expect(error).toMatchObject({ code: "blocked_address" });
    expect(requestPaths).toEqual([]);
  });

  it("blocks on the address the socket resolved, not the one the pre-check saw", async () => {
    const error = await safeFetch(`http://localhost:${port}/secret`, {
      timeoutMs: 5000,
    }).catch((thrown: unknown) => thrown);

    expect(String(error)).toMatch(
      /localhost resolves to blocked address (::1|127\.0\.0\.1)/,
    );
    expect(String(error)).not.toContain("93.184.216.34");
  });

  it("still completes a request the gate allows", async () => {
    // Sole allowed destination a test can bind: `net.connect` skips DNS for an
    // address literal, so the connector hands the socket straight through and
    // the rest of the pipeline (dispatcher, streaming, `.url`) runs for real.
    const res = await safeFetch(`http://127.0.0.1:${port}/hello`, {
      timeoutMs: 5000,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain");
    expect(res.url).toBe(`http://127.0.0.1:${port}/hello`);
    await expect(res.text()).resolves.toBe("reached the private service");
    expect(requestPaths).toEqual(["/hello"]);
  });
});
