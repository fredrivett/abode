import { afterEach, describe, expect, it } from "vitest";
import {
  clearNoteDraft,
  isBlankNote,
  NOTE_DRAFT_STORAGE_KEY,
  readNoteDraft,
  writeNoteDraft,
} from "./note-draft";

afterEach(() => {
  window.localStorage.clear();
});

describe("isBlankNote", () => {
  it("treats an empty string as blank", () => {
    expect(isBlankNote("")).toBe(true);
  });

  it("treats a lone heading marker and whitespace as blank", () => {
    expect(isBlankNote("# ")).toBe(true);
    expect(isBlankNote("#\n\n")).toBe(true);
    expect(isBlankNote("##   \n # \n")).toBe(true);
  });

  it("treats real content as not blank", () => {
    expect(isBlankNote("# Title")).toBe(false);
    expect(isBlankNote("#\n\nbody")).toBe(false);
  });
});

describe("writeNoteDraft / readNoteDraft", () => {
  it("round-trips a non-blank draft", () => {
    writeNoteDraft("# Groceries\n\nmilk");
    expect(readNoteDraft()).toBe("# Groceries\n\nmilk");
    expect(window.localStorage.getItem(NOTE_DRAFT_STORAGE_KEY)).toBe(
      "# Groceries\n\nmilk",
    );
  });

  it("returns null when nothing is stored", () => {
    expect(readNoteDraft()).toBeNull();
  });

  it("clears the stored draft when writing a blank note", () => {
    writeNoteDraft("# Groceries\n\nmilk");
    writeNoteDraft("# ");
    expect(window.localStorage.getItem(NOTE_DRAFT_STORAGE_KEY)).toBeNull();
    expect(readNoteDraft()).toBeNull();
  });

  it("does not surface a stored-but-blank draft as content", () => {
    window.localStorage.setItem(NOTE_DRAFT_STORAGE_KEY, "#\n");
    expect(readNoteDraft()).toBeNull();
  });
});

describe("clearNoteDraft", () => {
  it("removes a stored draft", () => {
    writeNoteDraft("# Note\n\nbody");
    clearNoteDraft();
    expect(readNoteDraft()).toBeNull();
    expect(window.localStorage.getItem(NOTE_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("is a no-op when there is no draft", () => {
    expect(() => clearNoteDraft()).not.toThrow();
    expect(readNoteDraft()).toBeNull();
  });
});
