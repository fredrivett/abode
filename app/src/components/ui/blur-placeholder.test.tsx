import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlurPlaceholder } from "./blur-placeholder";

const URL = "data:image/webp;base64,AAAA";

describe("BlurPlaceholder", () => {
  it("is fully opaque while visible and sets the background image", () => {
    const { container } = render(<BlurPlaceholder blurDataUrl={URL} visible />);
    const div = container.firstElementChild;
    expect(div?.className).toContain("opacity-100");
    expect(div?.getAttribute("style")).toContain("background-image");
  });

  it("fades out when not visible", () => {
    const { container } = render(
      <BlurPlaceholder blurDataUrl={URL} visible={false} />,
    );
    expect(container.firstElementChild?.className).toContain("opacity-0");
  });
});
