import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MasonryGrid, type MasonryGridProps } from "./masonry-grid";

type Card = { id: string; width: number; height: number; fresh?: boolean };

const square = (id: string, extra?: Partial<Card>): Card => ({
  id,
  width: 1,
  height: 1,
  ...extra,
});

function Grid(props: Partial<MasonryGridProps<Card>> & { items: Card[] }) {
  return (
    <MasonryGrid<Card>
      getKey={(card) => card.id}
      getFrame={(card) => ({ width: card.width, height: card.height })}
      renderItem={(card) => <span>{card.id}</span>}
      // 320px container → 3 columns of 100px with 10px gaps
      minColumnWidth={100}
      gap={10}
      {...props}
    />
  );
}

function cell(id: string): HTMLElement {
  const element = screen.getByText(id).closest("[data-grid-item]");
  if (!(element instanceof HTMLElement)) throw new Error(`no cell for ${id}`);
  return element;
}

describe("MasonryGrid", () => {
  beforeEach(() => {
    // jsdom has no layout: give containers a width to lay out against
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(320);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      setTimeout(() => callback(performance.now()), 0),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("positions items in order into the shortest column", () => {
    render(
      <Grid
        items={[
          square("a", { height: 2 }),
          square("b"),
          square("c"),
          square("d"),
        ]}
      />,
    );
    expect(cell("a").style.transform).toBe("translate3d(0px, 0px, 0)");
    expect(cell("b").style.transform).toBe("translate3d(110px, 0px, 0)");
    expect(cell("c").style.transform).toBe("translate3d(220px, 0px, 0)");
    expect(cell("d").style.transform).toBe("translate3d(110px, 110px, 0)");
    expect(cell("a").style.height).toBe("200px");
    // DOM order follows item order (tab order, screen readers)
    expect(
      [...document.querySelectorAll("[data-grid-item]")].map((element) =>
        element.getAttribute("data-grid-item"),
      ),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("sizes the container to the tallest column", () => {
    const { container } = render(
      <Grid items={[square("a", { height: 2 }), square("b")]} />,
    );
    expect(container.firstElementChild).toHaveStyle({ height: "200px" });
  });

  it("doesn't move existing items when more are appended", () => {
    const firstPage = [square("a", { height: 2 }), square("b"), square("c")];
    const { rerender } = render(<Grid items={firstPage} />);
    const before = firstPage.map((card) => cell(card.id).style.transform);

    rerender(
      <Grid items={[...firstPage, square("d"), square("e", { height: 2 })]} />,
    );

    expect(firstPage.map((card) => cell(card.id).style.transform)).toEqual(
      before,
    );
  });

  it("keeps an item's column when an earlier item changes shape", () => {
    const { rerender } = render(
      <Grid items={[square("a"), square("b"), square("c"), square("d")]} />,
    );
    expect(cell("d").style.transform).toBe("translate3d(0px, 110px, 0)");

    rerender(
      <Grid
        items={[
          square("a", { height: 2 }),
          square("b"),
          square("c"),
          square("d"),
        ]}
      />,
    );

    // Still under a, just pushed down by a's extra height
    expect(cell("d").style.transform).toBe("translate3d(0px, 210px, 0)");
  });

  it("animates changes only after the first layout", () => {
    const { rerender } = render(<Grid items={[square("a")]} animate />);
    expect(cell("a").style.transition).toBe("");

    rerender(<Grid items={[square("a", { height: 2 })]} animate />);
    expect(cell("a").style.transition).toContain("transform 300ms");
  });

  it("doesn't animate unless asked", () => {
    const { rerender } = render(<Grid items={[square("a")]} />);
    rerender(<Grid items={[square("a", { height: 2 })]} />);
    expect(cell("a").style.transition).toBe("");
  });

  it("grows a newly-added item in from zero height", async () => {
    const grid = (items: Card[]) => (
      <Grid
        items={items}
        animate
        shouldGrowIn={(card) => card.fresh === true}
      />
    );
    // A full row, so adding one doesn't change the column count (which
    // relays out without animating)
    const row = [square("a"), square("b"), square("c")];
    const { rerender } = render(grid(row));

    rerender(grid([square("new", { fresh: true }), ...row]));
    expect(cell("new").style.height).toBe("0px");
    expect(cell("new").style.overflow).toBe("hidden");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(cell("new").style.height).toBe("100px");
  });

  it("doesn't grow in items present on the first layout", () => {
    render(
      <Grid
        items={[square("a", { fresh: true })]}
        animate
        shouldGrowIn={() => true}
      />,
    );
    expect(cell("a").style.height).toBe("100px");
  });

  it("forwards its ref to the container", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Grid items={[square("a")]} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.querySelector("[data-grid-item]")).not.toBeNull();
  });
});
