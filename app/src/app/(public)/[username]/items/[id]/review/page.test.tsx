import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadPublicItem, getPublicBookReview, getSaveCtaState, notFound } =
  vi.hoisted(() => ({
    loadPublicItem: vi.fn(),
    getPublicBookReview: vi.fn(),
    getSaveCtaState: vi.fn(),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  }));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("../_lib/public-item", () => ({
  loadPublicItem,
  getPublicBookReview,
  getSaveCtaState,
}));
vi.mock("@/components/book/book-review-layout", () => ({
  BookReviewLayout: () => null,
}));
vi.mock("@/components/book/reader-review", () => ({
  ReaderReview: () => null,
}));
vi.mock("@/components/share/save-to-abode-cta", () => ({
  SaveToAbodeCta: () => null,
}));

import type { ReactElement } from "react";
import BookReviewPage, { generateMetadata } from "./page";

const params = Promise.resolve({ username: "@fred", id: "item-1" });
const user = {
  username: "fred",
  firstName: "Fred",
  lastName: null,
  avatarUrl: null,
};
const book = {
  id: "item-1",
  title: "Elon Musk",
  authors: ["Walter Isaacson"],
  sourceUrl: "https://example.com/elon-musk",
};
const review = {
  status: "read",
  rating: 7,
  review: "Fascinating.",
  startedAt: null,
  startedAtPrecision: null,
  finishedAt: null,
  finishedAtPrecision: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  loadPublicItem.mockResolvedValue({
    user,
    item: { id: "item-1" },
    viewerId: null,
    isOwner: false,
  });
  getPublicBookReview.mockReturnValue({ book, review });
  getSaveCtaState.mockResolvedValue({ isSignedIn: false, invitesOpen: true });
});

// The layout's children: the review, then the save CTA
async function rendered() {
  const page = (await BookReviewPage({ params })) as ReactElement<{
    children: ReactElement<{ book: unknown; children: ReactElement[] }>;
  }>;
  const layout = page.props.children;
  const [readerReview, saveCta] = layout.props.children as ReactElement<
    Record<string, unknown>
  >[];
  return { layout, readerReview, saveCta };
}

describe("book review page", () => {
  it("shows the owner's review of the book", async () => {
    const { layout, readerReview } = await rendered();
    expect(layout.props.book).toBe(book);
    expect(readerReview.props).toMatchObject({
      reader: user,
      review,
    });
  });

  it("offers non-owners the save CTA for the book's link", async () => {
    const { saveCta } = await rendered();
    expect(saveCta.props).toMatchObject({
      itemId: "item-1",
      sourceUrl: "https://example.com/elon-musk",
      ownerUsername: "fred",
      isSignedIn: false,
      invitesOpen: true,
    });
  });

  it("hides the save CTA from the owner", async () => {
    getSaveCtaState.mockResolvedValue(null);
    const { saveCta } = await rendered();
    expect(saveCta).toBeFalsy();
  });

  it("404s when the item isn't viewable", async () => {
    loadPublicItem.mockResolvedValue(null);
    await expect(BookReviewPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s when the item isn't a book", async () => {
    getPublicBookReview.mockReturnValue(null);
    await expect(BookReviewPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("titles the page as the reader's review, with an excerpt", async () => {
    expect(await generateMetadata({ params })).toEqual({
      title: "Elon Musk | @fred's review | abode",
      description: "Fascinating.",
    });
  });

  it("doesn't call it a review when there's no rating or review", async () => {
    getPublicBookReview.mockReturnValue({
      book,
      review: { ...review, rating: null, review: null },
    });
    expect((await generateMetadata({ params })).title).toBe(
      "Elon Musk | @fred | abode",
    );
  });

  it("doesn't leak a hidden book through metadata", async () => {
    loadPublicItem.mockResolvedValue(null);
    expect(await generateMetadata({ params })).toEqual({ title: "Not found" });
  });
});
