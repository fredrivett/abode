import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useDocumentTitle } from "./use-document-title";

describe("useDocumentTitle", () => {
  beforeEach(() => {
    document.title = "Original";
  });

  afterEach(() => {
    document.title = "";
  });

  it("sets the title while mounted", () => {
    renderHook(() => useDocumentTitle("New Title"));
    expect(document.title).toBe("New Title");
  });

  it("restores the previous title on unmount", () => {
    const { unmount } = renderHook(() => useDocumentTitle("New Title"));
    expect(document.title).toBe("New Title");
    unmount();
    expect(document.title).toBe("Original");
  });

  it("leaves the title untouched when given null", () => {
    renderHook(() => useDocumentTitle(null));
    expect(document.title).toBe("Original");
  });

  it("restores the original when the title becomes null", () => {
    const { rerender } = renderHook(
      ({ title }: { title: string | null }) => useDocumentTitle(title),
      { initialProps: { title: "Set" as string | null } },
    );
    expect(document.title).toBe("Set");
    rerender({ title: null });
    expect(document.title).toBe("Original");
  });

  it("updates when the title changes and still restores the original", () => {
    const { rerender, unmount } = renderHook(
      ({ title }) => useDocumentTitle(title),
      { initialProps: { title: "First" } },
    );
    expect(document.title).toBe("First");

    rerender({ title: "Second" });
    expect(document.title).toBe("Second");

    unmount();
    expect(document.title).toBe("Original");
  });
});
