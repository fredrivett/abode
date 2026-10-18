import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SensitiveItemTile } from "./sensitive-item-tile";

describe("SensitiveItemTile", () => {
  it("opens on click", () => {
    const onOpen = vi.fn();
    render(<SensitiveItemTile blurDataUrl={null} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button", { name: /Sensitive item/ }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("paints the placeholder colours only when there's an LQIP", () => {
    const { container, rerender } = render(
      <SensitiveItemTile
        blurDataUrl="data:image/png;base64,AA"
        onOpen={() => {}}
      />,
    );
    expect(
      container.querySelector("[style*='background-image']"),
    ).not.toBeNull();

    rerender(<SensitiveItemTile blurDataUrl={null} onOpen={() => {}} />);
    expect(container.querySelector("[style*='background-image']")).toBeNull();
  });
});
