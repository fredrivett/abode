import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LiteralBook,
  LiteralReadingState,
  LiteralReview,
} from "@/lib/imports/literal/client";

// The client is fully mocked below, but importActual still loads the real
// client module (which imports safe-fetch) — stub it so nothing server-only or
// network-bound is pulled into this unit test.
vi.mock("@/lib/http/safe-fetch", () => ({ safeFetch: vi.fn() }));

const fetchReadingStates = vi.hoisted(() => vi.fn());
const fetchReviews = vi.hoisted(() => vi.fn());
const loginToLiteral = vi.hoisted(() => vi.fn());
const profileIdFromToken = vi.hoisted(() => vi.fn());

// Mock the network layer but keep LiteralApiError real (the adapter throws it).
vi.mock("@/lib/imports/literal/client", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/imports/literal/client")>()),
  fetchReadingStates,
  fetchReviews,
  loginToLiteral,
  profileIdFromToken,
}));

import { fetchLiteralBooks } from "@/lib/imports/literal/adapter";
import { LiteralApiError } from "@/lib/imports/literal/client";

const book = (id: string): LiteralBook => ({
  id,
  slug: id,
  title: `Title ${id}`,
  subtitle: null,
  description: null,
  cover: null,
  language: "en",
  authors: [{ name: "A" }],
  isbn13: null,
  isbn10: null,
  pageCount: 0,
  publishedDate: null,
  publisher: null,
});

const state = (id: string, bk: LiteralBook | null): LiteralReadingState => ({
  id: `rs-${id}`,
  status: "FINISHED",
  createdAt: "2025-01-01T00:00:00.000Z",
  book: bk,
});

const review = (rating: number): LiteralReview => ({
  rating,
  text: `review-${rating}`,
  createdAt: "2025-01-01T00:00:00.000Z",
});

beforeEach(() => {
  fetchReadingStates.mockReset();
  fetchReviews.mockReset();
  loginToLiteral.mockReset();
  profileIdFromToken.mockReset();
});

describe("fetchLiteralBooks", () => {
  it("filters null-book states BEFORE pairing, keeping reviews aligned to books", async () => {
    profileIdFromToken.mockReturnValue("p1");
    // Middle state has no book (deleted upstream) — must be dropped, and must NOT
    // shift the review-to-book alignment for the surviving books.
    fetchReadingStates.mockResolvedValue([
      state("a", book("bk1")),
      state("b", null),
      state("c", book("bk3")),
    ]);
    fetchReviews.mockResolvedValue([review(4), review(5)]); // for bk1, bk3

    const books = await fetchLiteralBooks({ token: "tok" });

    // Pairs are built from the filtered list only (no null-book entry).
    expect(fetchReviews).toHaveBeenCalledWith("tok", [
      { profileId: "p1", bookId: "bk1" },
      { profileId: "p1", bookId: "bk3" },
    ]);
    expect(books).toHaveLength(2);
    expect(books[0].sourceId).toBe("bk1");
    expect(books[0].reading.rating).toBe(8); // review(4) → 4×2
    expect(books[1].sourceId).toBe("bk3");
    expect(books[1].reading.rating).toBe(10); // review(5) → 5×2, NOT bk1's review
  });

  it("maps a null review to an unrated book (index preserved)", async () => {
    profileIdFromToken.mockReturnValue("p1");
    fetchReadingStates.mockResolvedValue([
      state("a", book("bk1")),
      state("c", book("bk3")),
    ]);
    fetchReviews.mockResolvedValue([null, review(3)]);

    const books = await fetchLiteralBooks({ token: "tok" });
    expect(books[0].reading.rating).toBeNull();
    expect(books[1].reading.rating).toBe(6);
  });

  it("throws when a token has no resolvable profileId", async () => {
    profileIdFromToken.mockReturnValue(null);
    await expect(fetchLiteralBooks({ token: "bad" })).rejects.toBeInstanceOf(
      LiteralApiError,
    );
    expect(fetchReadingStates).not.toHaveBeenCalled();
  });

  it("logs in with email/password and uses the returned profileId", async () => {
    loginToLiteral.mockResolvedValue({ token: "t2", profileId: "p2" });
    fetchReadingStates.mockResolvedValue([state("a", book("bk1"))]);
    fetchReviews.mockResolvedValue([null]);

    const books = await fetchLiteralBooks({ email: "a@b.c", password: "x" });

    expect(loginToLiteral).toHaveBeenCalledWith({
      email: "a@b.c",
      password: "x",
    });
    expect(profileIdFromToken).not.toHaveBeenCalled();
    expect(fetchReadingStates).toHaveBeenCalledWith("t2");
    expect(fetchReviews).toHaveBeenCalledWith("t2", [
      { profileId: "p2", bookId: "bk1" },
    ]);
    expect(books).toHaveLength(1);
  });
});
