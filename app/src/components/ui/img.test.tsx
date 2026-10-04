import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IMAGE_RETRY_DELAYS_MS } from "@/lib/image-retry";
import { Img } from "./img";

describe("Img", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders the src and forwards img attributes", () => {
    render(<Img src="/photo.jpg" alt="A beach" loading="lazy" />);
    const img = screen.getByRole("img", { name: "A beach" });
    expect(img).toHaveAttribute("src", "/photo.jpg");
    expect(img).toHaveAttribute("loading", "lazy");
  });

  it("retries a failed load, and only reports the error once retries run out", () => {
    const onError = vi.fn();
    render(<Img src="/photo.jpg" alt="A beach" onError={onError} />);
    const img = screen.getByRole("img", { name: "A beach" });

    IMAGE_RETRY_DELAYS_MS.forEach((delay, index) => {
      fireEvent.error(img);
      expect(onError).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(delay));
      expect(img).toHaveAttribute("src", `/photo.jpg?retry=${index + 1}`);
    });

    fireEvent.error(img);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("reports a third-party failure straight away (no retry)", () => {
    const onError = vi.fn();
    render(
      <Img src="https://example.com/a.jpg" alt="Remote" onError={onError} />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Remote" }));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("still calls the caller's onLoad", () => {
    const onLoad = vi.fn();
    render(<Img src="/photo.jpg" alt="A beach" onLoad={onLoad} />);
    fireEvent.load(screen.getByRole("img", { name: "A beach" }));
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});
