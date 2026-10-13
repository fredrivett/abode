import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  loadPublicItem,
  getSharedHighlight,
  getVisibleHighlights,
  getSaveCtaState,
  notFound,
} = vi.hoisted(() => ({
  loadPublicItem: vi.fn(),
  getSharedHighlight: vi.fn(),
  getVisibleHighlights: vi.fn(),
  getSaveCtaState: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("../../_lib/public-item", () => ({
  loadPublicItem,
  getSharedHighlight,
  getVisibleHighlights,
  getSaveCtaState,
  toClientItem: (item: unknown) => item,
}));
vi.mock("../../_components/item-detail-view", () => ({
  ItemDetailView: () => null,
}));

import SharedHighlightPage, { generateMetadata } from "./page";

const params = Promise.resolve({
  username: "@fred",
  id: "item-1",
  highlightId: "hl-1",
});
const featured = { id: "hl-1", text: "Less, but better." };
const other = { id: "hl-2", text: "Good design is honest." };

beforeEach(() => {
  vi.clearAllMocks();
  loadPublicItem.mockResolvedValue({
    user: {
      username: "fred",
      firstName: null,
      lastName: null,
      avatarUrl: null,
    },
    item: { id: "item-1", title: "Good design" },
    viewerId: null,
    isOwner: false,
  });
  getSharedHighlight.mockResolvedValue(featured);
  getSaveCtaState.mockResolvedValue({ isSignedIn: false, invitesOpen: true });
});

async function renderedProps() {
  const element = await SharedHighlightPage({ params });
  return element.props;
}

describe("shared highlight page", () => {
  it("features the highlight and marks only it when others aren't shared", async () => {
    getVisibleHighlights.mockResolvedValue([]);
    const props = await renderedProps();
    expect(props.featuredHighlight).toBe(featured);
    expect(props.highlights).toEqual([featured]);
    // The reader lands on the quote at the top, not mid-article
    expect(props.scrollToHighlightId).toBeNull();
  });

  it("passes the save CTA state for this viewer", async () => {
    getVisibleHighlights.mockResolvedValue([]);
    expect((await renderedProps()).saveCta).toEqual({
      isSignedIn: false,
      invitesOpen: true,
    });
  });

  it("shows all highlights when the owner shares them", async () => {
    getVisibleHighlights.mockResolvedValue([featured, other]);
    expect((await renderedProps()).highlights).toEqual([featured, other]);
  });

  it("404s when the highlight isn't viewable", async () => {
    getSharedHighlight.mockResolvedValue(null);
    await expect(SharedHighlightPage({ params })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("404s when the item isn't viewable", async () => {
    loadPublicItem.mockResolvedValue(null);
    await expect(SharedHighlightPage({ params })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(getSharedHighlight).not.toHaveBeenCalled();
  });

  it("titles the page with the quote", async () => {
    const metadata = await generateMetadata({ params });
    expect(metadata.title).toBe("“Less, but better.” | @fred | abode");
    expect(metadata.description).toBe("Highlighted by @fred from Good design");
  });

  it("doesn't leak a hidden highlight through metadata", async () => {
    getSharedHighlight.mockResolvedValue(null);
    expect(await generateMetadata({ params })).toEqual({ title: "Not found" });
  });
});
