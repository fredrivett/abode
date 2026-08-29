import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RatingStars } from "./rating-stars";

describe("RatingStars", () => {
  // jsdom's getBoundingClientRect returns all zeros, which would always read
  // as "left half" — stub a real rect so left/right-half math is exercised.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 100,
      width: 20,
      top: 0,
      height: 20,
      right: 120,
      bottom: 20,
      x: 100,
      y: 0,
      toJSON: () => {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onChange with a half-star value when clicking the left half of a star", () => {
    const onChange = vi.fn();
    render(<RatingStars rating={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Rate 3 stars" }), {
      clientX: 105,
    });
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("calls onChange with a whole-star value when clicking the right half of a star", () => {
    const onChange = vi.fn();
    render(<RatingStars rating={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Rate 3 stars" }), {
      clientX: 115,
    });
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("previews the hovered value and reverts to the committed rating on mouse leave", () => {
    render(<RatingStars rating={4} onChange={vi.fn()} />);
    const star3 = screen.getByRole("button", { name: "Rate 3 stars" });
    const row = star3.parentElement as HTMLElement;

    // Left half of star 3 previews 2.5 stars (2 full + 1 half overlay)
    fireEvent.mouseMove(star3, { clientX: 105 });
    expect(row.querySelectorAll('[class*="fill-yellow-400"]')).toHaveLength(3);

    // Leaving the row reverts the display to the committed rating (2 stars)
    fireEvent.mouseLeave(row);
    expect(row.querySelectorAll('[class*="fill-yellow-400"]')).toHaveLength(2);
  });

  it("only shows the clear button when a rating is set", () => {
    const { rerender } = render(
      <RatingStars rating={null} onChange={vi.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: "Clear rating" }),
    ).not.toBeInTheDocument();

    rerender(<RatingStars rating={8} onChange={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Clear rating" }),
    ).toBeInTheDocument();
  });

  it("calls onChange with null when the clear button is clicked", () => {
    const onChange = vi.fn();
    render(<RatingStars rating={8} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear rating" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
