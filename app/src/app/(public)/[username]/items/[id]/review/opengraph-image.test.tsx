import { ImageResponse } from "next/og";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/og", () => ({
  ImageResponse: vi.fn(function ImageResponseStub() {
    return new Response("png", {
      headers: { "content-type": "image/png" },
    });
  }),
}));

vi.mock("@/lib/og/data", () => ({
  parseOgUsername: (raw: string) => (raw.startsWith("@") ? raw.slice(1) : null),
  getOgBookReview: vi.fn(),
}));

vi.mock("@/components/book/book-review-share-card", () => ({
  BookReviewShareCard: vi.fn(() => <div data-card="book-review" />),
}));

import { BookReviewShareCard } from "@/components/book/book-review-share-card";
import { getOgBookReview } from "@/lib/og/data";
import Image, { contentType } from "./opengraph-image";

const mockGetOgBookReview = vi.mocked(getOgBookReview);
const mockCard = vi.mocked(BookReviewShareCard);
const mockImageResponse = vi.mocked(ImageResponse);

const params = (username: string) =>
  Promise.resolve({ username, id: "item-1" });

const review = {
  status: "read" as const,
  rating: 7,
  review: "Fascinating.",
  startedAt: null,
  startedAtPrecision: null,
  finishedAt: null,
  finishedAtPrecision: null,
};

// The element handed to ImageResponse
function renderedElement() {
  const element = mockImageResponse.mock.calls[0]?.[0];
  if (!isValidElement<Record<string, unknown>>(element)) {
    throw new Error("ImageResponse was not called with an element");
  }
  return element;
}

describe("book review opengraph-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("declares a png content type", () => {
    expect(contentType).toBe("image/png");
  });

  it("renders the review card for a viewable book, cover inlined", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("jpg", { headers: { "content-type": "image/jpeg" } }),
      ),
    );
    mockGetOgBookReview.mockResolvedValue({
      title: "Elon Musk",
      authors: ["Walter Isaacson"],
      coverFileKey: "covers/elon.jpg",
      coverRatio: 2 / 3,
      coverColor: "#1c1d22",
      review,
      ownerUsername: "fred",
    });

    const res = await Image({ params: params("@fred") });

    expect(res.headers.get("content-type")).toBe("image/png");
    expect(mockGetOgBookReview).toHaveBeenCalledWith({
      username: "fred",
      itemId: "item-1",
    });
    // Called directly (not rendered) so satori can preload the cover image
    expect(renderedElement().props).toEqual({ "data-card": "book-review" });
    expect(mockCard.mock.calls[0]?.[0]).toMatchObject({
      title: "Elon Musk",
      authors: ["Walter Isaacson"],
      review,
      ownerUsername: "fred",
      coverColor: "#1c1d22",
      coverHref: "data:image/jpeg;base64,anBn",
    });
  });

  it("draws a plain board for a book without a cover", async () => {
    mockGetOgBookReview.mockResolvedValue({
      title: "Dune",
      authors: [],
      coverFileKey: null,
      coverRatio: 2 / 3,
      coverColor: null,
      review,
      ownerUsername: "fred",
    });

    await Image({ params: params("@fred") });

    expect(mockCard.mock.calls[0]?.[0].coverHref).toBeNull();
  });

  it("falls back to the branded card when the book isn't viewable", async () => {
    mockGetOgBookReview.mockResolvedValue(null);

    await Image({ params: params("@fred") });

    expect(mockCard).not.toHaveBeenCalled();
  });

  it("falls back without querying when the username lacks an @", async () => {
    await Image({ params: params("fred") });

    expect(mockGetOgBookReview).not.toHaveBeenCalled();
    expect(mockCard).not.toHaveBeenCalled();
  });
});
