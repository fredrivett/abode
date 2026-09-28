import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useMediaQuery = vi.hoisted(() => vi.fn<() => boolean>());

vi.mock("usehooks-ts", () => ({ useMediaQuery }));

import {
  DialogOrDrawer,
  DialogOrDrawerContent,
  DialogOrDrawerDescription,
  DialogOrDrawerTitle,
} from "./dialog-or-drawer";

function Fixture() {
  return (
    <DialogOrDrawer open>
      <DialogOrDrawerContent>
        <DialogOrDrawerTitle>Save as Room</DialogOrDrawerTitle>
        <DialogOrDrawerDescription>Body copy</DialogOrDrawerDescription>
      </DialogOrDrawerContent>
    </DialogOrDrawer>
  );
}

describe("DialogOrDrawer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a dialog on desktop", () => {
    useMediaQuery.mockReturnValue(true);
    render(<Fixture />);

    expect(
      document.querySelector('[data-slot="dialog-content"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-slot="drawer-content"]')).toBeNull();
    expect(screen.getByText("Save as Room")).toBeInTheDocument();
  });

  it("renders a drawer on mobile", () => {
    useMediaQuery.mockReturnValue(false);
    render(<Fixture />);

    expect(
      document.querySelector('[data-slot="drawer-content"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(screen.getByText("Save as Room")).toBeInTheDocument();
  });

  // Regression: the root shares its variant with every sub-component via context.
  // Here the root reads desktop while every sub-component's own query would read
  // mobile — the disagreement that caused the original crash. React renders the
  // root first (consuming the `once`) and never re-renders it, so the root stays
  // dialog. The context fix keeps sub-components in sync (a coherent dialog tree);
  // the buggy per-component queries would render DrawerContent inside a Dialog
  // root and throw.
  it("renders a coherent tree when root and sub-components disagree on the query", () => {
    useMediaQuery
      .mockReturnValueOnce(true) // root decides dialog
      .mockReturnValue(false); // sub-components' own query would say drawer
    expect(() => render(<Fixture />)).not.toThrow();

    // Coherent desktop dialog tree — no drawer primitive leaks in
    expect(document.querySelectorAll('[data-slot^="drawer"]')).toHaveLength(0);
    expect(
      document.querySelector('[data-slot="dialog-content"]'),
    ).not.toBeNull();
  });
});
