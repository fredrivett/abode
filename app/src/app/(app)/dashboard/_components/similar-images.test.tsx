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

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
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

  it("captures a click event and calls onNavigate", () => {
    setResults([sampleItem]);
    const onNavigate = vi.fn();
    render(
      <SimilarImages
        itemId="source-1"
        enabled={true}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("link"));

    expect(onNavigate).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledWith("similar_image_clicked", {
      item_id: "source-1",
      target_item_id: "target-1",
    });
  });

  it("passes enabled through to the data hook", () => {
    setResults([]);
    render(<SimilarImages itemId="source-1" enabled={false} />);
    expect(mockUseSimilarImages).toHaveBeenCalledWith("source-1", false);
  });
});
