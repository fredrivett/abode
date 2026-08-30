import { beforeEach, describe, expect, test, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());

vi.mock("./supabase/client", () => ({
  createClient: () => ({
    auth: { getSession },
  }),
}));

import { ApiClientError, api, isDailyLimitError } from "./api-client";
import { DAILY_LIMIT_REACHED_CODE } from "./usage-limits.shared";

describe("api-client", () => {
  beforeEach(() => {
    getSession.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  test("adds Authorization header when session is present", async () => {
    getSession.mockResolvedValueOnce({
      data: { session: { access_token: "token-123" } },
    });

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await api.get<{ ok: boolean }>("/api/test");

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];

    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-123");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init.method).toBe("GET");
  });

  test("preserves caller-specified Content-Type", async () => {
    getSession.mockResolvedValueOnce({
      data: { session: null },
    });

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await api.post<{ ok: boolean }>(
      "/api/test",
      { a: 1 },
      { headers: new Headers({ "Content-Type": "text/plain" }) },
    );

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];

    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("text/plain");
  });

  test("throws ApiClientError with JSON message and code", async () => {
    getSession.mockResolvedValueOnce({
      data: { session: null },
    });

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Bad request", code: "BAD" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(api.get("/api/test")).rejects.toEqual(
      expect.objectContaining<ApiClientError>({
        name: "ApiClientError",
        message: "Bad request",
        status: 400,
        code: "BAD",
      }),
    );
  });

  test("falls back to statusText for non-JSON errors", async () => {
    getSession.mockResolvedValueOnce({
      data: { session: null },
    });

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("nope", { status: 500, statusText: "Server Error" }),
    );

    await expect(api.get("/api/test")).rejects.toEqual(
      expect.objectContaining<ApiClientError>({
        name: "ApiClientError",
        message: "Server Error",
        status: 500,
      }),
    );
  });

  test("returns empty object for 204 responses", async () => {
    getSession.mockResolvedValueOnce({
      data: { session: null },
    });

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );

    await expect(api.delete("/api/test")).resolves.toEqual({});
  });
});

describe("isDailyLimitError", () => {
  test("true for a 429 carrying the daily-limit code", () => {
    const error = new ApiClientError({
      message: "Daily limit reached",
      status: 429,
      code: DAILY_LIMIT_REACHED_CODE,
    });
    expect(isDailyLimitError(error)).toBe(true);
  });

  test("false for a 429 without the code (per-minute / once-per-day caps)", () => {
    const error = new ApiClientError({
      message: "Too many requests",
      status: 429,
    });
    expect(isDailyLimitError(error)).toBe(false);
  });

  test("false for other error codes and non-ApiClientError values", () => {
    expect(
      isDailyLimitError(
        new ApiClientError({ message: "Nope", status: 400, code: "BAD" }),
      ),
    ).toBe(false);
    expect(isDailyLimitError(new Error("Daily limit reached"))).toBe(false);
    expect(isDailyLimitError(null)).toBe(false);
    expect(isDailyLimitError("Daily limit reached")).toBe(false);
  });
});
