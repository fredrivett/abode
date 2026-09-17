import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { OpenItemSeed } from "../item-dialog-context";
import { ItemDialogSkeletonBody } from "./item-dialog-skeleton";

// Avoid pulling the heavy item-card module in for a shared className constant.
vi.mock("../item-card", () => ({ DETAIL_IMAGE_CLASSNAME: "detail-image" }));

// DialogTitle needs a Dialog context in real use; stub it to a plain element.
vi.mock("@/components/ui/dialog", () => ({
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/lib/image-url", () => ({
  getProxyImageUrl: (key: string) => `proxy:${key}`,
}));

const baseSeed: OpenItemSeed = {
  id: "z",
  imageFileKey: "user/photo.jpg",
  title: "A beach",
  kind: "image",
  blurDataUrl: null,
};

describe("ItemDialogSkeletonBody", () => {
  it("shows the seed cover full-width for image-like kinds", () => {
    render(<ItemDialogSkeletonBody seed={{ ...baseSeed, kind: "image" }} />);
    const img = screen.getByRole("img", { name: "A beach" });
    expect(img).toHaveAttribute("src", "proxy:user/photo.jpg");
    expect(screen.queryByText("Loading")).not.toBeInTheDocument();
  });

  it("shows a neutral loading pane for a webpage (its detail keys off coverFileKey, not the seed's fileKey fallback)", () => {
    render(<ItemDialogSkeletonBody seed={{ ...baseSeed, kind: "webpage" }} />);
    expect(
      screen.queryByRole("img", { name: "A beach" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("shows a neutral loading pane (not the cover) for a tweet", () => {
    render(<ItemDialogSkeletonBody seed={{ ...baseSeed, kind: "twitter" }} />);
    // The cover here is just a thumbnail of a tweet — don't flash it full-width.
    expect(
      screen.queryByRole("img", { name: "A beach" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("shows a neutral loading pane when the kind is unknown", () => {
    render(<ItemDialogSkeletonBody seed={{ ...baseSeed, kind: null }} />);
    expect(
      screen.queryByRole("img", { name: "A beach" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("shows a neutral loading pane when there's no seed cover", () => {
    render(
      <ItemDialogSkeletonBody
        seed={{ ...baseSeed, kind: "image", imageFileKey: null }}
      />,
    );
    expect(
      screen.queryByRole("img", { name: "A beach" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });
});
