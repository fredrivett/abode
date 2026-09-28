// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAuth,
  mockGetItems,
  mockGetItem,
  mockListFilters,
  mockListRooms,
  mockRateLimit,
  mockCapture,
  mockCaptureException,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetItems: vi.fn(),
  mockGetItem: vi.fn(),
  mockListFilters: vi.fn(),
  mockListRooms: vi.fn(),
  mockRateLimit: vi.fn(),
  mockCapture: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock("@/lib/auth/authenticate-request", () => ({
  authenticateRequest: mockAuth,
}));

vi.mock("@/lib/mcp/tools", () => ({
  MCP_MAX_LIMIT: 50,
  getItems: mockGetItems,
  getItem: mockGetItem,
  listFilters: mockListFilters,
  listRooms: mockListRooms,
}));

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mockRateLimit }));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ capture: mockCapture }),
  captureServerException: mockCaptureException,
}));

vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { POST } from "./route";

const TOKEN_AUTH = {
  user: { id: "user_1" },
  method: "pat",
  tokenId: "tok_1",
} as const;

let nextId = 1;

// A 2025-era (stateless legacy) JSON-RPC call, as Claude Code / Cursor send today
function rpc(method: string, params: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: "Bearer abode_pat_x",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  }) as unknown as Parameters<typeof POST>[0];
}

// The response is JSON or a single-message SSE stream, depending on negotiation
async function rpcResult(response: Response) {
  const body = await response.text();
  const json = response.headers
    .get("content-type")
    ?.includes("text/event-stream")
    ? (body
        .split("\n")
        .find((line) => line.startsWith("data:"))
        ?.slice(5) ?? "{}")
    : body;
  return JSON.parse(json);
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const response = await POST(rpc("tools/call", { name, arguments: args }));
  expect(response.status).toBe(200);
  const { result } = await rpcResult(response);
  return result as {
    isError?: boolean;
    content: { type: string; text: string }[];
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(TOKEN_AUTH);
  mockRateLimit.mockReturnValue({ allowed: true, remaining: 29, resetAt: 0 });
});

describe("/api/mcp auth", () => {
  it("requires the read scope", async () => {
    await POST(rpc("tools/list"));
    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), {
      tokenScope: "read",
    });
  });

  it("rejects an unauthenticated (or wrong-scope) caller with a plain bearer challenge", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await POST(rpc("tools/list"));
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe(
      'Bearer realm="abode"',
    );
    expect(mockGetItems).not.toHaveBeenCalled();
  });
});

describe("/api/mcp tools", () => {
  it("lists the four read-only tools", async () => {
    const { result } = await rpcResult(await POST(rpc("tools/list")));
    const tools: { name: string; annotations?: { readOnlyHint?: boolean } }[] =
      result.tools;
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_item",
      "get_items",
      "list_filters",
      "list_rooms",
    ]);
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
  });

  it("get_items searches the caller's library and records the call", async () => {
    mockGetItems.mockResolvedValue([{ id: "i1", title: "Saved" }]);

    const result = await callTool("get_items", {
      query: "chairs",
      kinds: ["image"],
    });

    expect(mockGetItems).toHaveBeenCalledWith("user_1", {
      query: "chairs",
      kinds: ["image"],
    });
    expect(JSON.parse(result.content[0]?.text ?? "")).toEqual([
      { id: "i1", title: "Saved" },
    ]);
    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: "user_1",
      event: "mcp_tool_called",
      properties: {
        tool: "get_items",
        success: true,
        auth_method: "pat",
        token_id: "tok_1",
      },
    });
  });

  it("applies the search rate limit to queries, not to browsing", async () => {
    mockGetItems.mockResolvedValue([]);
    await callTool("get_items", {});
    expect(mockRateLimit).not.toHaveBeenCalled();

    mockRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: 0,
      retryAfter: 42,
    });
    const limited = await callTool("get_items", { query: "chairs" });
    expect(mockRateLimit).toHaveBeenCalledWith("user_1", "search");
    expect(limited.isError).toBe(true);
    expect(limited.content[0]?.text).toContain("42 seconds");
    expect(mockGetItems).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown item kind before querying", async () => {
    const response = await POST(
      rpc("tools/call", { name: "get_items", arguments: { kinds: ["nope"] } }),
    );
    const { result, error } = await rpcResult(response);
    expect(result?.isError ?? Boolean(error)).toBe(true);
    expect(mockGetItems).not.toHaveBeenCalled();
  });

  it("get_item returns the item, or a not-found tool error", async () => {
    mockGetItem.mockResolvedValueOnce({ id: "i1", title: "One" });
    const found = await callTool("get_item", { id: "i1" });
    expect(mockGetItem).toHaveBeenCalledWith("user_1", "i1");
    expect(JSON.parse(found.content[0]?.text ?? "")).toEqual({
      id: "i1",
      title: "One",
    });

    mockGetItem.mockResolvedValueOnce(null);
    const missing = await callTool("get_item", { id: "nope" });
    expect(missing.isError).toBe(true);
    expect(missing.content[0]?.text).toBe("Item not found.");
  });

  it("list_filters and list_rooms are scoped to the caller", async () => {
    mockListFilters.mockResolvedValue({ tag: ["chairs"] });
    mockListRooms.mockResolvedValue([{ id: "r1", name: "Home" }]);

    await callTool("list_filters");
    await callTool("list_rooms");

    expect(mockListFilters).toHaveBeenCalledWith("user_1");
    expect(mockListRooms).toHaveBeenCalledWith("user_1");
  });

  it("turns an unexpected failure into a reported tool error without leaking it", async () => {
    mockListRooms.mockRejectedValue(new Error("db exploded: secret detail"));

    const result = await callTool("list_rooms");

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe(
      "Something went wrong running this tool.",
    );
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      "user_1",
      { route: "mcp", tool: "list_rooms" },
    );
    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          tool: "list_rooms",
          success: false,
        }),
      }),
    );
  });

  it("serves a web session caller too, with no token id", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user_2" }, method: "bearer" });
    mockListRooms.mockResolvedValue([]);

    await callTool("list_rooms");

    expect(mockListRooms).toHaveBeenCalledWith("user_2");
    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          auth_method: "bearer",
          token_id: null,
        }),
      }),
    );
  });
});
