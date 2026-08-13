import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecuteScript } = vi.hoisted(() => ({
  mockExecuteScript: vi.fn(),
}));

vi.mock("wxt/browser", () => ({
  browser: { scripting: { executeScript: mockExecuteScript } },
}));

import { captureRenderedHtml } from "./capture";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("captureRenderedHtml", () => {
  it("returns the rendered HTML from the injected script", async () => {
    const html = "<html><body><p>rendered</p></body></html>";
    mockExecuteScript.mockResolvedValue([{ result: html }]);

    await expect(captureRenderedHtml(42)).resolves.toBe(html);
    expect(mockExecuteScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 42 } }),
    );
  });

  it("returns null when the tab can't be scripted (restricted page)", async () => {
    // chrome://, the Web Store, view-source, the PDF viewer, etc. throw.
    mockExecuteScript.mockRejectedValue(new Error("Cannot access this page"));

    await expect(captureRenderedHtml(1)).resolves.toBeNull();
  });

  it("returns null for an empty result", async () => {
    mockExecuteScript.mockResolvedValue([{ result: "" }]);

    await expect(captureRenderedHtml(1)).resolves.toBeNull();
  });

  it("returns null when the injection result is missing or non-string", async () => {
    mockExecuteScript.mockResolvedValue([{ result: undefined }]);
    await expect(captureRenderedHtml(1)).resolves.toBeNull();

    mockExecuteScript.mockResolvedValue([]);
    await expect(captureRenderedHtml(1)).resolves.toBeNull();

    mockExecuteScript.mockResolvedValue([{ result: 123 }]);
    await expect(captureRenderedHtml(1)).resolves.toBeNull();
  });
});
