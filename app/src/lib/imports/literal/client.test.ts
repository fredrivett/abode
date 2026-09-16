import { beforeEach, describe, expect, it, vi } from "vitest";

const safeFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/http/safe-fetch", () => ({ safeFetch }));

import {
  fetchReadingStates,
  fetchReviews,
  LiteralApiError,
  loginToLiteral,
  profileIdFromToken,
} from "@/lib/imports/literal/client";

/** Build a fake Response with the shape literalGraphql reads (.ok/.status/.json). */
const gql = (body: unknown, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

/** Encode a JWT whose payload is `payload` (signature is irrelevant here). */
const jwt = (payload: unknown) =>
  `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

beforeEach(() => {
  safeFetch.mockReset();
});

describe("profileIdFromToken", () => {
  it("extracts the profileId claim from a JWT", () => {
    expect(profileIdFromToken(jwt({ profileId: "cld5pr7" }))).toBe("cld5pr7");
  });

  it("returns null for a token without the claim / malformed / non-JWT", () => {
    expect(profileIdFromToken(jwt({ type: "ACCESS_TOKEN" }))).toBeNull();
    expect(profileIdFromToken("not-a-jwt")).toBeNull();
    expect(profileIdFromToken("h.@@notbase64@@.s")).toBeNull();
  });
});

describe("literalGraphql error handling (via fetchReadingStates)", () => {
  it("throws on a non-OK HTTP status", async () => {
    safeFetch.mockResolvedValue(gql({}, { ok: false, status: 502 }));
    await expect(fetchReadingStates("t")).rejects.toBeInstanceOf(
      LiteralApiError,
    );
    await expect(fetchReadingStates("t")).rejects.toThrow("502");
  });

  it("throws with the GraphQL error messages", async () => {
    safeFetch.mockResolvedValue(gql({ errors: [{ message: "boom" }] }));
    await expect(fetchReadingStates("t")).rejects.toThrow("boom");
  });

  it("throws when the response has no data", async () => {
    safeFetch.mockResolvedValue(gql({}));
    await expect(fetchReadingStates("t")).rejects.toThrow(/no data/i);
  });

  it("throws when the body isn't valid JSON", async () => {
    safeFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    });
    await expect(fetchReadingStates("t")).rejects.toBeInstanceOf(
      LiteralApiError,
    );
    await expect(fetchReadingStates("t")).rejects.toThrow(/non-JSON/i);
  });

  it("throws when the body is null / not an object", async () => {
    safeFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => null,
    });
    await expect(fetchReadingStates("t")).rejects.toBeInstanceOf(
      LiteralApiError,
    );
  });

  it("sends the bearer token", async () => {
    safeFetch.mockResolvedValue(gql({ data: { myReadingStates: [] } }));
    await fetchReadingStates("my-token");
    expect(safeFetch.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer my-token",
    );
  });
});

describe("loginToLiteral", () => {
  it("returns the token + profileId, unauthenticated (no bearer header)", async () => {
    safeFetch.mockResolvedValue(
      gql({ data: { login: { token: "tok", profile: { id: "p1" } } } }),
    );
    const session = await loginToLiteral({ email: "a@b.c", password: "x" });
    expect(session).toEqual({ token: "tok", profileId: "p1" });
    expect(safeFetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("throws when login returns no token", async () => {
    safeFetch.mockResolvedValue(gql({ data: { login: null } }));
    await expect(
      loginToLiteral({ email: "a@b.c", password: "x" }),
    ).rejects.toBeInstanceOf(LiteralApiError);
  });
});

describe("fetchReviews", () => {
  it("chunks pairs and concatenates results in input order", async () => {
    // 250 pairs → 3 chunks (100/100/50). Each chunk echoes bookId as review.text
    // so we can prove the concatenation preserves order across chunk boundaries.
    safeFetch.mockImplementation(async (_url, init) => {
      const { variables } = JSON.parse(init.body);
      const pairs = variables.pairs as { bookId: string }[];
      return gql({
        data: {
          reviews: pairs.map((p) => ({
            rating: null,
            text: p.bookId,
            createdAt: null,
          })),
        },
      });
    });

    const pairs = Array.from({ length: 250 }, (_, i) => ({
      profileId: "p1",
      bookId: `bk${i}`,
    }));
    const reviews = await fetchReviews("t", pairs);

    expect(safeFetch).toHaveBeenCalledTimes(3); // 100 + 100 + 50
    expect(reviews).toHaveLength(250);
    // Every review lines up with its input pair — no cross-chunk misalignment.
    for (let i = 0; i < pairs.length; i++) {
      expect(reviews[i]?.text).toBe(`bk${i}`);
    }
  });

  it("makes no request for an empty pair list", async () => {
    const reviews = await fetchReviews("t", []);
    expect(reviews).toEqual([]);
    expect(safeFetch).not.toHaveBeenCalled();
  });
});
