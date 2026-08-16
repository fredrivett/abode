import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Filter } from "@/lib/search/types";
import { RoomCard } from "./room-card";

const filters: Filter[] = [
  { id: "1", type: "location", value: "Brazil", negated: false },
];

function renderCard(props: Partial<Parameters<typeof RoomCard>[0]> = {}) {
  return render(
    <RoomCard
      href="/@fr/seahaven"
      name="Seahaven"
      emoji="🏡"
      itemCount={5}
      type="manual"
      {...props}
    />,
  );
}

describe("RoomCard", () => {
  it("renders the name, emoji, and link", () => {
    renderCard();
    expect(screen.getByText("Seahaven")).toBeInTheDocument();
    expect(screen.getByText("🏡")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/@fr/seahaven");
  });

  it("omits the emoji when none is provided", () => {
    renderCard({ emoji: null });
    expect(screen.queryByText("🏡")).not.toBeInTheDocument();
  });

  describe("public badge", () => {
    it("is hidden by default", () => {
      renderCard();
      expect(screen.queryByText("Public")).not.toBeInTheDocument();
    });

    it("is hidden when showPublicBadge is false", () => {
      renderCard({ showPublicBadge: false });
      expect(screen.queryByText("Public")).not.toBeInTheDocument();
    });

    it("shows when showPublicBadge is true", () => {
      renderCard({ showPublicBadge: true });
      expect(screen.getByText("Public")).toBeInTheDocument();
    });
  });

  describe("type indicator", () => {
    it("shows Static for manual rooms", () => {
      renderCard({ type: "manual" });
      expect(screen.getByText("Static")).toBeInTheDocument();
      expect(screen.queryByText("Dynamic")).not.toBeInTheDocument();
    });

    it("shows Dynamic for smart rooms", () => {
      renderCard({ type: "smart" });
      expect(screen.getByText("Dynamic")).toBeInTheDocument();
      expect(screen.queryByText("Static")).not.toBeInTheDocument();
    });
  });

  describe("item count", () => {
    it("uses the singular 'item' for a count of one", () => {
      renderCard({ itemCount: 1 });
      expect(screen.getByText("1 item")).toBeInTheDocument();
    });

    it("uses the plural 'items' for other counts", () => {
      renderCard({ itemCount: 5 });
      expect(screen.getByText("5 items")).toBeInTheDocument();
    });
  });

  describe("filter preview", () => {
    it("renders filters for a smart room", () => {
      renderCard({ type: "smart", filters });
      expect(screen.getByText("Brazil")).toBeInTheDocument();
    });

    it("does not render filters for a manual room", () => {
      renderCard({ type: "manual", filters });
      expect(screen.queryByText("Brazil")).not.toBeInTheDocument();
    });

    it("does not render a preview when a smart room has no filters", () => {
      renderCard({ type: "smart", filters: null });
      expect(screen.queryByText("Brazil")).not.toBeInTheDocument();
    });
  });

  describe("thumbnail strip", () => {
    it("renders an image per thumbnail", () => {
      const { container } = renderCard({
        thumbnails: [
          { url: "/a.jpg", blurDataUrl: null },
          { url: "/b.jpg", blurDataUrl: "data:blur" },
        ],
      });
      expect(container.querySelectorAll("img")).toHaveLength(2);
    });

    it("renders no thumbnail strip when the list is empty", () => {
      const { container } = renderCard({ thumbnails: [] });
      expect(container.querySelectorAll("img")).toHaveLength(0);
    });

    it("renders no thumbnail strip when thumbnails are omitted", () => {
      const { container } = renderCard();
      expect(container.querySelectorAll("img")).toHaveLength(0);
    });
  });
});
