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

import { BookReviewShareCard } from "@/components/book/book-review-share-card";
import { getOgBookReview } from "@/lib/og/data";
import Image, { contentType } from "./opengraph-image";

const mockGetOgBookReview = vi.mocked(getOgBookReview);
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
  beforeEach(() => vi.clearAllMocks());

  it("declares a png content type", () => {
    expect(contentType).toBe("image/png");
  });

  it("renders the review card for a viewable book", async () => {
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
    const element = renderedElement();
    expect(element.type).toBe(BookReviewShareCard);
    expect(element.props).toMatchObject({
      title: "Elon Musk",
      authors: ["Walter Isaacson"],
      review,
      ownerUsername: "fred",
      coverColor: "#1c1d22",
    });
    expect(element.props.renderCover).toEqual(expect.any(Function));
  });

  it("draws a typeset board for a book without a cover", async () => {
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

    expect(renderedElement().props.renderCover).toBeNull();
  });

  it("falls back to the branded card when the book isn't viewable", async () => {
    mockGetOgBookReview.mockResolvedValue(null);

    await Image({ params: params("@fred") });

    expect(renderedElement().type).not.toBe(BookReviewShareCard);
  });

  it("falls back without querying when the username lacks an @", async () => {
    await Image({ params: params("fred") });

    expect(mockGetOgBookReview).not.toHaveBeenCalled();
    expect(renderedElement().type).not.toBe(BookReviewShareCard);
  });
});
