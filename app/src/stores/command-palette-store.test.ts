import { beforeEach, describe, expect, it } from "vitest";
import { useCommandPaletteStore } from "./command-palette-store";

beforeEach(() => {
  useCommandPaletteStore.setState({
    uploadDialogOpen: false,
    uploadDialogFocusUrl: false,
  });
});

describe("setUploadDialogOpen", () => {
  it("opens without forcing URL focus by default", () => {
    useCommandPaletteStore.getState().setUploadDialogOpen(true);
    expect(useCommandPaletteStore.getState()).toMatchObject({
      uploadDialogOpen: true,
      uploadDialogFocusUrl: false,
    });
  });

  it("opens with URL focus when asked", () => {
    useCommandPaletteStore
      .getState()
      .setUploadDialogOpen(true, { focusUrl: true });
    expect(useCommandPaletteStore.getState().uploadDialogFocusUrl).toBe(true);
  });

  it("clears URL focus on close so the next plain open doesn't inherit it", () => {
    const { setUploadDialogOpen } = useCommandPaletteStore.getState();
    setUploadDialogOpen(true, { focusUrl: true });
    setUploadDialogOpen(false);
    expect(useCommandPaletteStore.getState().uploadDialogFocusUrl).toBe(false);
    setUploadDialogOpen(true);
    expect(useCommandPaletteStore.getState().uploadDialogFocusUrl).toBe(false);
  });
});
