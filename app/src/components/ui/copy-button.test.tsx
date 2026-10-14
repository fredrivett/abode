// fireEvent, not user-event: user-event swaps in its own navigator.clipboard
import { act, fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./copy-button";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn(writeText) },
    configurable: true,
  });
  // No fallback, so a rejected write is a failed copy
  Object.defineProperty(document, "execCommand", {
    value: vi.fn().mockReturnValue(false),
    configurable: true,
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("CopyButton", () => {
  it("ticks and toasts once the copy lands", async () => {
    stubClipboard(() => Promise.resolve());
    render(
      <CopyButton text="hello" label="Copy URL" successMessage="Copied" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy URL" }));

    expect(
      await screen.findByRole("button", { name: "Copied" }),
    ).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
    expect(toast.success).toHaveBeenCalledWith("Copied");
  });

  it("shows a failure and toasts when the copy is denied", async () => {
    stubClipboard(() =>
      Promise.reject(new DOMException("", "NotAllowedError")),
    );
    render(<CopyButton text="hello" label="Copy URL" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy URL" }));

    expect(
      await screen.findByRole("button", { name: "Copy failed" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Couldn't copy to clipboard", {
      description: expect.any(String),
    });
  });

  it("spins while the browser is still deciding, then resolves", async () => {
    vi.useFakeTimers();
    let grant: () => void = () => {};
    stubClipboard(
      () =>
        new Promise<void>((resolve) => {
          grant = resolve;
        }),
    );
    render(<CopyButton text="hello" label="Copy URL" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy URL" }));
    // A quick write never flashes the spinner
    expect(
      screen.getByRole("button", { name: "Copy URL" }),
    ).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole("button", { name: "Copying" })).toBeInTheDocument();

    await act(async () => grant());
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2000));
    expect(
      screen.getByRole("button", { name: "Copy URL" }),
    ).toBeInTheDocument();
  });
});
