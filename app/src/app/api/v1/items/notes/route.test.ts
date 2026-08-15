import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, mockCreateNote, mockClearNoteDraft, mockCapture } =
  vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockCreateNote: vi.fn(),
    mockClearNoteDraft: vi.fn(),
    mockCapture: vi.fn(),
  }));

vi.mock("@/lib/auth/authenticate-request", () => ({
  authenticateRequest: mockAuth,
}));

vi.mock("@/lib/url", () => ({ getAppBaseUrl: () => "https://www.abode.fyi" }));

vi.mock("@/lib/items/create-note", () => ({ createNote: mockCreateNote }));

vi.mock("@/lib/items/note-draft", () => ({
  clearNoteDraft: mockClearNoteDraft,
}));

// transformItem is exercised elsewhere; here it just needs to pass the item through.
vi.mock("@/lib/items/query", () => ({
  transformItem: (item: unknown) => item,
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ capture: mockCapture }),
  captureServerException: vi.fn(),
}));

vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { OPTIONS, POST } from "./route";

function request(
  body: Record<string, unknown>,
  { authorization, origin }: { authorization?: string; origin?: string } = {},
) {
  return {
    json: async () => body,
    headers: {
      get: (key: string) => {
        const k = key.toLowerCase();
        if (k === "authorization") return authorization ?? null;
        if (k === "origin") return origin ?? null;
        return null;
      },
    },
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user_1" }, method: "cookie" });
  mockCreateNote.mockResolvedValue({ id: "note_1", kind: "note" });
  mockClearNoteDraft.mockResolvedValue(undefined);
});

describe("POST /api/v1/items/notes", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(request({ content: "hello" }));
    expect(res.status).toBe(401);
    expect(mockCreateNote).not.toHaveBeenCalled();
  });

  it("returns 400 when content is not a string", async () => {
    const res = await POST(request({ content: 123 }));
    expect(res.status).toBe(400);
    expect(mockCreateNote).not.toHaveBeenCalled();
  });

  it("returns 400 when title is not a string or null", async () => {
    const res = await POST(request({ content: "hi", title: 5 }));
    expect(res.status).toBe(400);
    expect(mockCreateNote).not.toHaveBeenCalled();
  });

  it("creates the note and clears the draft on the happy path", async () => {
    const res = await POST(request({ content: "a quote", title: "Source" }));
    expect(res.status).toBe(201);
    // In-app composer omits source → defaults to "web"
    expect(mockCreateNote).toHaveBeenCalledWith("user_1", {
      content: "a quote",
      title: "Source",
      source: "web",
    });
    expect(mockClearNoteDraft).toHaveBeenCalledWith("user_1");
  });

  it("defaults an invalid source to web", async () => {
    const res = await POST(request({ content: "a quote", source: "bogus" }));
    expect(res.status).toBe(201);
    expect(mockCreateNote).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({ source: "web" }),
    );
  });

  it("saves via a bearer-authenticated request (the extension selection path)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user_1" }, method: "bearer" });
    const res = await POST(
      request(
        { content: "highlighted text", source: "extension" },
        { authorization: "Bearer token-abc", origin: "chrome-extension://abc" },
      ),
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "chrome-extension://abc",
    );
    // The extension's source is threaded through to createNote
    expect(mockCreateNote).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({ source: "extension" }),
    );
  });
});

describe("OPTIONS /api/v1/items/notes", () => {
  it("answers the CORS preflight with 204", async () => {
    const res = await OPTIONS(
      request({}, { origin: "chrome-extension://abc" }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "chrome-extension://abc",
    );
  });
});
