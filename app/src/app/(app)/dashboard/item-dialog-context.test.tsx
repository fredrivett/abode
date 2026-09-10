import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ItemDialogProvider,
  useItemDetailDialog,
  useItemDialog,
} from "./item-dialog-context";

// Controllable next/navigation mock — a stable instance per value.
const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.params,
}));

// Test consumer that exposes the context controls.
let ctx: ReturnType<typeof useItemDialog>;
function Consumer() {
  ctx = useItemDialog();
  return <span data-testid="open">{ctx?.openItemId ?? "none"}</span>;
}

function renderProvider() {
  return render(
    <ItemDialogProvider>
      <Consumer />
    </ItemDialogProvider>,
  );
}

describe("ItemDialogProvider", () => {
  let pushSpy: ReturnType<typeof vi.spyOn>;
  let replaceSpy: ReturnType<typeof vi.spyOn>;
  let backSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    nav.params = new URLSearchParams();
    window.history.replaceState(null, "", "/");
    pushSpy = vi.spyOn(window.history, "pushState");
    replaceSpy = vi.spyOn(window.history, "replaceState");
    backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });

  afterEach(() => {
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
    backSpy.mockRestore();
  });

  it("exposes the open item id from the URL", () => {
    nav.params = new URLSearchParams("item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");
    const { getByTestId } = renderProvider();
    expect(getByTestId("open").textContent).toBe("2c4a9f0e-1b23-4d56-8e90-abcdef012345");
  });

  it("reports no open item when the param is absent", () => {
    renderProvider();
    expect(ctx?.openItemId).toBeNull();
  });

  it("opens an item by pushing the item param onto history", () => {
    window.history.replaceState(null, "", "/?q=cat");
    const { getByTestId, rerender } = renderProvider();

    act(() => ctx?.openItem("2c4a9f0e-1b23-4d56-8e90-abcdef012345"));

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const url = String(pushSpy.mock.calls[0][2]);
    expect(url).toContain("q=cat");
    expect(url).toContain("item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");

    // Simulate the router reflecting the pushed URL, then confirm the provider
    // publishes the new open item (not just that it wrote history).
    nav.params = new URLSearchParams("q=cat&item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");
    rerender(
      <ItemDialogProvider>
        <Consumer />
      </ItemDialogProvider>,
    );
    expect(getByTestId("open").textContent).toBe("2c4a9f0e-1b23-4d56-8e90-abcdef012345");
  });

  it("closes via history.back() when it opened the dialog itself", () => {
    renderProvider();

    act(() => ctx?.openItem("2c4a9f0e-1b23-4d56-8e90-abcdef012345"));
    pushSpy.mockClear();
    act(() => ctx?.closeItem());

    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it("closes a deep-linked dialog by stripping the param in place", () => {
    // Item present in the URL on load — never opened via pushState this session
    nav.params = new URLSearchParams("item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");
    window.history.replaceState(null, "", "/?item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");
    renderProvider();
    replaceSpy.mockClear();

    act(() => ctx?.closeItem());

    expect(backSpy).not.toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    const url = String(replaceSpy.mock.calls[0][2]);
    expect(url).not.toContain("item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");
  });

  it("publishes no open item once the URL param is gone", () => {
    // The router reflects a closed dialog (param stripped) — the provider must
    // stop reporting the item as open, not just have written history.
    nav.params = new URLSearchParams("item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");
    const { getByTestId, rerender } = renderProvider();
    expect(getByTestId("open").textContent).toBe("2c4a9f0e-1b23-4d56-8e90-abcdef012345");

    nav.params = new URLSearchParams();
    rerender(
      <ItemDialogProvider>
        <Consumer />
      </ItemDialogProvider>,
    );
    expect(getByTestId("open").textContent).toBe("none");
  });

  it("sets the tab title from a report matching the open item", () => {
    nav.params = new URLSearchParams("item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");
    document.title = "abode";
    renderProvider();

    act(() => ctx?.reportItemTitle({ id: "2c4a9f0e-1b23-4d56-8e90-abcdef012345", title: "My Item" }));

    expect(document.title).toBe("My Item | abode");
  });

  it("ignores a report tagged with a different item id", () => {
    // Guards the effect-ordering hazard: a stale report (e.g. a closing dialog)
    // must not blank or hijack the current open item's title.
    nav.params = new URLSearchParams("item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");
    document.title = "abode";
    renderProvider();

    act(() => ctx?.reportItemTitle({ id: "other", title: "Stale" }));

    expect(document.title).toBe("abode");
  });

  it("keeps the open item's title when a later mismatched report arrives", () => {
    nav.params = new URLSearchParams("item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");
    document.title = "abode";
    renderProvider();

    act(() => ctx?.reportItemTitle({ id: "2c4a9f0e-1b23-4d56-8e90-abcdef012345", title: "My Item" }));
    expect(document.title).toBe("My Item | abode");

    // A stale report (e.g. a dialog mid-exit) must not overwrite/blank it
    act(() => ctx?.reportItemTitle({ id: "other", title: "Stale" }));
    expect(document.title).toBe("My Item | abode");
  });

  it("clears the reported title when the open item goes away", () => {
    nav.params = new URLSearchParams("item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");
    document.title = "abode";
    const { rerender } = renderProvider();
    act(() => ctx?.reportItemTitle({ id: "2c4a9f0e-1b23-4d56-8e90-abcdef012345", title: "My Item" }));
    expect(document.title).toBe("My Item | abode");

    // Dialog closed: URL open-item gone → the provider drops the stale title
    nav.params = new URLSearchParams();
    rerender(
      <ItemDialogProvider>
        <Consumer />
      </ItemDialogProvider>,
    );
    expect(document.title).toBe("abode");
  });

  it("leaves the tab title untouched before any item is opened", () => {
    nav.params = new URLSearchParams();
    document.title = "[branch] abode";
    renderProvider();
    expect(document.title).toBe("[branch] abode");
  });

  it("restores the exact captured base title on close", () => {
    // Loaded without an item open → the provider captures the base title
    // (including the dev branch prefix) to restore verbatim later.
    nav.params = new URLSearchParams();
    document.title = "[branch] abode";
    const { rerender } = renderProvider();

    nav.params = new URLSearchParams("item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");
    rerender(
      <ItemDialogProvider>
        <Consumer />
      </ItemDialogProvider>,
    );
    act(() => ctx?.reportItemTitle({ id: "2c4a9f0e-1b23-4d56-8e90-abcdef012345", title: "My Item" }));
    expect(document.title).toBe("My Item | abode");

    nav.params = new URLSearchParams();
    rerender(
      <ItemDialogProvider>
        <Consumer />
      </ItemDialogProvider>,
    );
    expect(document.title).toBe("[branch] abode");
  });
});

describe("useItemDetailDialog", () => {
  let backSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    nav.params = new URLSearchParams();
    window.history.replaceState(null, "", "/");
    backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });

  afterEach(() => {
    backSpy.mockRestore();
  });

  const withProvider = ({ children }: { children: ReactNode }) => (
    <ItemDialogProvider>{children}</ItemDialogProvider>
  );

  it("derives open state from the URL when inside a provider", () => {
    nav.params = new URLSearchParams("item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");
    const { result } = renderHook(() => useItemDetailDialog("2c4a9f0e-1b23-4d56-8e90-abcdef012345"), {
      wrapper: withProvider,
    });
    expect(result.current.isOpen).toBe(true);
  });

  it("is closed for a different item than the one in the URL", () => {
    nav.params = new URLSearchParams("item=2c4a9f0e-1b23-4d56-8e90-abcdef012345");
    const { result } = renderHook(() => useItemDetailDialog("other"), {
      wrapper: withProvider,
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("falls back to local state with no provider", () => {
    const { result } = renderHook(() => useItemDetailDialog("2c4a9f0e-1b23-4d56-8e90-abcdef012345"));
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.setOpen(true));
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.setOpen(false));
    expect(result.current.isOpen).toBe(false);
  });
});
