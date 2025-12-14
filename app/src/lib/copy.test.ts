import { describe, expect, test, vi } from "vitest";
import { copyToClipboard } from "./copy";

describe("copyToClipboard", () => {
  test("uses navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });

    await expect(copyToClipboard("#ff00ff")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("#ff00ff");
    expect(execCommand).not.toHaveBeenCalled();
  });

  test("falls back to document.execCommand when clipboard fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("nope"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });

    await expect(copyToClipboard("#0a0a0a")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("#0a0a0a");
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  test("returns false when nothing can copy", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(document, "execCommand", {
      value: undefined,
      configurable: true,
    });

    await expect(copyToClipboard("#111111")).resolves.toBe(false);
  });
});
