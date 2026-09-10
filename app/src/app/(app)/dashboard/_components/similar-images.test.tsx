import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SimilarImagesResponse } from "@/app/api/v1/items/[id]/similar/route";
import { SimilarImages } from "./similar-images";

const mockUseSimilarImages = vi.fn();
vi.mock("@/lib/search/use-similar-images", () => ({
  useSimilarImages: (itemId: string, enabled: boolean) =>
    mockUseSimilarImages(itemId, enabled),
}));

vi.mock("@/stores/user-store", () => ({
  useUserStore: (selector: (s: { username: string | null }) => unknown) =>
    selector({ username: "fr" }),
}));

const capture = vi.fn();
vi.mock("posthog-js", () => ({
  default: { capture: (...args: unknown[]) => capture(...args) },
}));

const openItem = vi.fn();
let mockDialog: { openItem: typeof openItem } | null = { openItem };
vi.mock("../item-dialog-context", () => ({
  useItemDialog: () => mockDialog,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: (event: React.MouseEvent) => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

function setResults(items: SimilarImagesResponse["items"]) {
  mockUseSimilarImages.mockReturnValue({ data: { items } });
}

const BLUR = "data:image/webp;base64,AAAA";

const sampleItem = {
  id: "target-1",
  fileKey: "user/photo-1.jpg",
  title: "A beach",
  blurDataUrl: BLUR,
  similarity: 0.92,
};

describe("SimilarImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDialog = { openItem };
  });

  it("renders nothing when there are no matches", () => {
    setResults([]);
    const { container } = render(
      <SimilarImages itemId="source-1" enabled={true} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a heading and a thumbnail per match", () => {
    setResults([sampleItem]);
    render(<SimilarImages itemId="source-1" enabled={true} />);

    expect(screen.getByText("Similar images")).toBeInTheDocument();
    const img = screen.getByRole("img", { name: "A beach" });
    expect(img).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/@fr/items/target-1",
    );
  });

  it("renders a blur-up placeholder while the image loads", () => {
    setResults([sampleItem]);
    const { container } = render(
      <SimilarImages itemId="source-1" enabled={true} />,
    );

    const placeholder = container.querySelector("[aria-hidden]");
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveStyle({
      backgroundImage: `url("${BLUR}")`,
    });
  });

  it("omits the blur placeholder when the item has no LQIP", () => {
    setResults([{ ...sampleItem, blurDataUrl: null }]);
    const { container } = render(
      <SimilarImages itemId="source-1" enabled={true} />,
    );

    expect(container.querySelector("[aria-hidden]")).not.toBeInTheDocument();
    // The thumbnail still renders — the blur is an enhancement, not a gate.
    expect(screen.getByRole("img", { name: "A beach" })).toBeInTheDocument();
  });

  it("captures a viewed event once when results appear", () => {
    setResults([sampleItem]);
    render(<SimilarImages itemId="source-1" enabled={true} />);

    const viewed = capture.mock.calls.filter(
      ([event]) => event === "similar_images_viewed",
    );
    expect(viewed).toHaveLength(1);
    expect(viewed[0][1]).toMatchObject({
      item_id: "source-1",
      result_count: 1,
    });
  });

  it("opens the target in place (no navigation) on a plain click with a provider", () => {
    setResults([sampleItem]);
    render(<SimilarImages itemId="source-1" enabled={true} />);

    const notPrevented = fireEvent.click(screen.getByRole("link"));

    // Default navigation is prevented — we swap the dialog instead.
    expect(notPrevented).toBe(false);
    expect(openItem).toHaveBeenCalledWith("target-1", {
      id: "target-1",
      imageFileKey: "user/photo-1.jpg",
      title: "A beach",
      blurDataUrl: BLUR,
    });
    expect(capture).toHaveBeenCalledWith("similar_image_clicked", {
      item_id: "source-1",
      target_item_id: "target-1",
    });
  });

  it("falls through to navigation on a modifier click (open in new tab)", () => {
    setResults([sampleItem]);
    render(<SimilarImages itemId="source-1" enabled={true} />);

    const notPrevented = fireEvent.click(screen.getByRole("link"), {
      metaKey: true,
    });

    expect(notPrevented).toBe(true);
    expect(openItem).not.toHaveBeenCalled();
    // Still tracks the click.
    expect(capture).toHaveBeenCalledWith(
      "similar_image_clicked",
      expect.objectContaining({ target_item_id: "target-1" }),
    );
  });

  it("navigates normally when there's no dialog provider (e.g. room views)", () => {
    mockDialog = null;
    setResults([sampleItem]);
    render(<SimilarImages itemId="source-1" enabled={true} />);

    const notPrevented = fireEvent.click(screen.getByRole("link"));

    expect(notPrevented).toBe(true);
    expect(openItem).not.toHaveBeenCalled();
  });

  it("passes enabled through to the data hook", () => {
    setResults([]);
    render(<SimilarImages itemId="source-1" enabled={false} />);
    expect(mockUseSimilarImages).toHaveBeenCalledWith("source-1", false);
  });
});
