import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GRID_IMAGE_SIZES, getProxyImageUrl } from "@/lib/image-url";
import { BlurImage } from "./blur-image";
import { Img } from "./img";

const gridSrc = getProxyImageUrl("u/cover.jpg", "grid");

describe("Img", () => {
  it("adds a srcset when given sizes for a resized proxy URL", () => {
    render(<Img src={gridSrc} alt="cover" sizes={GRID_IMAGE_SIZES} />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("srcset")).toContain("w=400&q=80 400w");
    expect(img.getAttribute("sizes")).toBe(GRID_IMAGE_SIZES);
  });

  it("renders a plain src without sizes", () => {
    render(<Img src={gridSrc} alt="cover" />);
    expect(screen.getByRole("img").hasAttribute("srcset")).toBe(false);
  });

  it("drops sizes when there's nothing to choose between", () => {
    render(<Img src="blob:local" alt="cover" sizes={GRID_IMAGE_SIZES} />);
    const img = screen.getByRole("img");
    expect(img.hasAttribute("srcset")).toBe(false);
    expect(img.hasAttribute("sizes")).toBe(false);
  });
});

describe("BlurImage", () => {
  it("adds a srcset when given sizes", () => {
    render(
      <BlurImage
        src={gridSrc}
        alt="cover"
        blurDataUrl={null}
        sizes={GRID_IMAGE_SIZES}
      />,
    );
    expect(screen.getByRole("img").getAttribute("srcset")).toContain("600w");
  });
});
