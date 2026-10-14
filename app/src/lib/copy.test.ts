import { afterEach, describe, expect, test, vi } from "vitest";
import { copyToClipboard, describeCopyFailure } from "./copy";

// Stands in for a browser running the copy command: fires a copy event whose
// clipboardData the page can write to
function stubExecCommand({ fireEvent = true, returns = true } = {}) {
  const setData = vi.fn();
  const execCommand = vi.fn(() => {
    if (fireEvent) {
      const event = new Event("copy", { cancelable: true });
      Object.defineProperty(event, "clipboardData", { value: { setData } });
      document.dispatchEvent(event);
    }
    return returns;
  });
  Object.defineProperty(document, "execCommand", {
    value: execCommand,
    configurable: true,
  });
  return { execCommand, setData };
}

function stubClipboard(writeText?: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: writeText ? { writeText: vi.fn(writeText) } : undefined,
    configurable: true,
  });
}

function stubPermission(state: PermissionState | "unsupported") {
  Object.defineProperty(navigator, "permissions", {
    value: {
      query: vi.fn(() =>
        state === "unsupported"
          ? Promise.reject(new TypeError("unknown permission name"))
          : Promise.resolve({ state }),
      ),
    },
    configurable: true,
  });
}

const notAllowed = () =>
  Promise.reject(
    new DOMException("Write permission denied.", "NotAllowedError"),
  );

// Both routes fail, so the result carries the diagnosis
function failBothWays(writeText?: () => Promise<void>) {
  stubClipboard(writeText);
  stubExecCommand({ fireEvent: false, returns: false });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("copyToClipboard", () => {
  test("uses navigator.clipboard when available", async () => {
    stubClipboard(() => Promise.resolve());
    const { execCommand } = stubExecCommand();

    await expect(copyToClipboard("#ff00ff")).resolves.toEqual({ ok: true });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("#ff00ff");
    expect(execCommand).not.toHaveBeenCalled();
  });

  test("falls back to document.execCommand when clipboard fails", async () => {
    stubClipboard(() => Promise.reject(new Error("nope")));
    const { execCommand, setData } = stubExecCommand();

    await expect(copyToClipboard("#0a0a0a")).resolves.toEqual({ ok: true });
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(setData).toHaveBeenCalledWith("text/plain", "#0a0a0a");
  });

  test("fails when the copy command reports success but wrote nothing", async () => {
    stubClipboard();
    // execCommand returns true without firing a copy event
    stubExecCommand({ fireEvent: false });

    const result = await copyToClipboard("#222222");
    expect(result.ok).toBe(false);
  });

  test("rejects empty text", async () => {
    await expect(copyToClipboard("")).resolves.toEqual({
      ok: false,
      reason: "empty",
    });
  });

  describe("says why a copy failed", () => {
    test("the site's clipboard permission is blocked", async () => {
      failBothWays(notAllowed);
      stubPermission("denied");

      await expect(copyToClipboard("x")).resolves.toEqual({
        ok: false,
        reason: "permission-denied",
      });
    });

    test("the page wasn't focused", async () => {
      failBothWays(notAllowed);
      stubPermission("prompt");
      vi.spyOn(document, "hasFocus").mockReturnValue(false);

      await expect(copyToClipboard("x")).resolves.toEqual({
        ok: false,
        reason: "not-focused",
      });
    });

    test("refused for no reason it reports (e.g. Safari, no permission API)", async () => {
      failBothWays(notAllowed);
      stubPermission("unsupported");
      vi.spyOn(document, "hasFocus").mockReturnValue(true);

      await expect(copyToClipboard("x")).resolves.toEqual({
        ok: false,
        reason: "blocked",
      });
    });

    test("a plain-http page hides the Clipboard API", async () => {
      failBothWays();
      vi.stubGlobal("isSecureContext", false);

      await expect(copyToClipboard("x")).resolves.toEqual({
        ok: false,
        reason: "insecure-context",
      });
    });

    test("nothing can copy on a secure page", async () => {
      failBothWays();
      vi.stubGlobal("isSecureContext", true);

      await expect(copyToClipboard("x")).resolves.toEqual({
        ok: false,
        reason: "unsupported",
      });
    });

    test("an unexpected error", async () => {
      failBothWays(() => Promise.reject(new Error("boom")));

      await expect(copyToClipboard("x")).resolves.toEqual({
        ok: false,
        reason: "unknown",
      });
    });
  });
});

describe("describeCopyFailure", () => {
  test("explains the causes a user can act on", () => {
    expect(describeCopyFailure("permission-denied")).toMatch(/site settings/);
    expect(describeCopyFailure("insecure-context")).toMatch(/https/);
    expect(describeCopyFailure("not-focused")).toMatch(/Click the page/);
  });

  test("adds nothing when there's nothing useful to say", () => {
    expect(describeCopyFailure("unknown")).toBeNull();
    expect(describeCopyFailure("empty")).toBeNull();
  });
});
