import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlurImage } from "./blur-image";

const BLUR = "data:image/webp;base64,AAAA";

describe("BlurImage", () => {
  it("renders the image and a blur placeholder over it", () => {
    const { container } = render(
      <BlurImage src="/photo.jpg" alt="A beach" blurDataUrl={BLUR} />,
    );

    expect(screen.getByRole("img", { name: "A beach" })).toHaveAttribute(
      "src",
      "/photo.jpg",
    );
    const placeholder = container.querySelector("[aria-hidden]");
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveStyle({ backgroundImage: `url("${BLUR}")` });
  });

  it("omits the placeholder when there is no LQIP", () => {
    const { container } = render(
      <BlurImage src="/photo.jpg" alt="A beach" blurDataUrl={null} />,
    );

    expect(screen.getByRole("img", { name: "A beach" })).toBeInTheDocument();
    expect(container.querySelector("[aria-hidden]")).not.toBeInTheDocument();
  });

  it("renders nothing when there is no src", () => {
    const { container } = render(
      <BlurImage src={null} alt="A beach" blurDataUrl={BLUR} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("forwards the loading attribute to the image", () => {
    render(
      <BlurImage
        src="/photo.jpg"
        alt="A beach"
        blurDataUrl={null}
        loading="lazy"
      />,
    );

    expect(screen.getByRole("img", { name: "A beach" })).toHaveAttribute(
      "loading",
      "lazy",
    );
  });
});
