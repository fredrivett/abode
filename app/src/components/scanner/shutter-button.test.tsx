import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShutterButton } from "./shutter-button";

const CIRCUMFERENCE = 2 * Math.PI * 34;

describe("ShutterButton", () => {
  it("hides the countdown ring in manual mode", () => {
    render(<ShutterButton onClick={() => {}} progress={null} />);
    expect(screen.queryByTestId("shutter-progress")).not.toBeInTheDocument();
  });

  it("fills the ring in proportion to the countdown", () => {
    render(<ShutterButton onClick={() => {}} progress={0.25} />);
    const ring = screen.getByTestId("shutter-progress");
    expect(Number(ring.getAttribute("stroke-dashoffset"))).toBeCloseTo(
      CIRCUMFERENCE * 0.75,
    );
  });

  it("clamps out-of-range progress", () => {
    render(<ShutterButton onClick={() => {}} progress={1.7} />);
    expect(
      Number(
        screen
          .getByTestId("shutter-progress")
          .getAttribute("stroke-dashoffset"),
      ),
    ).toBe(0);
  });

  it("captures on click unless disabled", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <ShutterButton onClick={onClick} progress={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Capture page" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<ShutterButton onClick={onClick} progress={null} disabled />);
    fireEvent.click(screen.getByRole("button", { name: "Capture page" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
