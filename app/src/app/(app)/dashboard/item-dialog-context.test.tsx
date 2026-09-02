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
    nav.params = new URLSearchParams("item=abc");
    const { getByTestId } = renderProvider();
    expect(getByTestId("open").textContent).toBe("abc");
  });

  it("reports no open item when the param is absent", () => {
    renderProvider();
    expect(ctx?.openItemId).toBeNull();
  });

  it("opens an item by pushing the item param onto history", () => {
    window.history.replaceState(null, "", "/?q=cat");
    renderProvider();

    act(() => ctx?.openItem("abc"));

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const url = String(pushSpy.mock.calls[0][2]);
    expect(url).toContain("q=cat");
    expect(url).toContain("item=abc");
  });

  it("closes via history.back() when it opened the dialog itself", () => {
    renderProvider();

    act(() => ctx?.openItem("abc"));
    pushSpy.mockClear();
    act(() => ctx?.closeItem());

    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it("closes a deep-linked dialog by stripping the param in place", () => {
    // Item present in the URL on load — never opened via pushState this session
    nav.params = new URLSearchParams("item=abc");
    window.history.replaceState(null, "", "/?item=abc");
    renderProvider();
    replaceSpy.mockClear();

    act(() => ctx?.closeItem());

    expect(backSpy).not.toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    const url = String(replaceSpy.mock.calls[0][2]);
    expect(url).not.toContain("item=abc");
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
    nav.params = new URLSearchParams("item=abc");
    const { result } = renderHook(() => useItemDetailDialog("abc"), {
      wrapper: withProvider,
    });
    expect(result.current.isOpen).toBe(true);
  });

  it("is closed for a different item than the one in the URL", () => {
    nav.params = new URLSearchParams("item=abc");
    const { result } = renderHook(() => useItemDetailDialog("other"), {
      wrapper: withProvider,
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("falls back to local state with no provider", () => {
    const { result } = renderHook(() => useItemDetailDialog("abc"));
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.setOpen(true));
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.setOpen(false));
    expect(result.current.isOpen).toBe(false);
  });
});
