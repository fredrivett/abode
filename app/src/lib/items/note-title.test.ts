import { describe, expect, test } from "vitest";
import { noteDisplayName, promoteNoteHeading } from "./note-title";

describe("promoteNoteHeading", () => {
  test("lifts a leading heading into the title and strips it from the body", () => {
    expect(
      promoteNoteHeading(
        "# Reading list\n\nBooks to get through this quarter:",
      ),
    ).toEqual({
      title: "Reading list",
      content: "Books to get through this quarter:",
    });
  });

  test("promotes any heading level", () => {
    expect(promoteNoteHeading("### Sub\nbody")).toEqual({
      title: "Sub",
      content: "body",
    });
  });

  test("ignores leading blank lines before the heading", () => {
    expect(promoteNoteHeading("\n\n# Title\nbody")).toEqual({
      title: "Title",
      content: "body",
    });
  });

  test("handles a heading-only note", () => {
    expect(promoteNoteHeading("# Just a title")).toEqual({
      title: "Just a title",
      content: "",
    });
  });

  test("strips ATX closing hashes but keeps attached ones", () => {
    expect(promoteNoteHeading("# Title #").title).toBe("Title");
    expect(promoteNoteHeading("# C++###").title).toBe("C++###");
  });

  test("does not promote a heading without a space (not valid ATX)", () => {
    expect(promoteNoteHeading("#NoSpace\nbody")).toEqual({
      title: null,
      content: "#NoSpace\nbody",
    });
  });

  test("does not promote a whitespace-only heading (empty title)", () => {
    expect(promoteNoteHeading("#   \n\nbody")).toEqual({
      title: null,
      content: "#   \n\nbody",
    });
  });

  test.each([
    ["a plain paragraph", "Just a thought\nmore text"],
    ["a bullet list", "* milk\n* eggs"],
    ["an ordered list", "1. first\n2. second"],
    ["a blockquote", "> a quote"],
  ])("leaves %s untouched (no title)", (_label, content) => {
    expect(promoteNoteHeading(content)).toEqual({ title: null, content });
  });

  test("returns no title for empty content", () => {
    expect(promoteNoteHeading("")).toEqual({ title: null, content: "" });
    expect(promoteNoteHeading("\n\n  \n")).toEqual({
      title: null,
      content: "\n\n  \n",
    });
  });

  test("truncates an overlong heading", () => {
    const { title } = promoteNoteHeading(`# ${"a".repeat(300)}`);
    expect(title).toHaveLength(200);
  });
});

describe("noteDisplayName", () => {
  test.each([
    ["# Reading list\nbody", "Reading list"],
    ["* Buy milk\n* eggs", "Buy milk"],
    ["1. First item", "First item"],
    ["> A quote", "A quote"],
    ["Just plain text", "Just plain text"],
    ["\n\n  Second line wins", "Second line wins"],
  ])("derives a name from %j", (content, expected) => {
    expect(noteDisplayName(content)).toBe(expected);
  });

  test("returns null when there is no text", () => {
    expect(noteDisplayName("")).toBeNull();
    expect(noteDisplayName("\n  \n")).toBeNull();
  });
});
