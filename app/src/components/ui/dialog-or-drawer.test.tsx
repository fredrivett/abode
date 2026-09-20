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

  // Regression: the root shares its variant with every sub-component via context, so
  // the tree is always coherent — exactly one root primitive and no mismatched content.
  // If sub-components read their own media query instead, a transient disagreement
  // renders a DialogContent inside a Drawer root and throws
  // "DialogPortal must be used within Dialog". Each mode must yield a single, coherent
  // primitive tree with no crash.
  it("renders a coherent tree with no stray primitive from the other variant", () => {
    useMediaQuery.mockReturnValue(false);
    expect(() => render(<Fixture />)).not.toThrow();

    // Mobile: only drawer primitives, never a dialog root/content/portal
    expect(document.querySelectorAll('[data-slot^="dialog"]')).toHaveLength(0);
    expect(
      document.querySelector('[data-slot="drawer-content"]'),
    ).not.toBeNull();
  });
});
