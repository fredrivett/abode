import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { getTextFromChildren } from "./get-text-from-children";

describe("getTextFromChildren", () => {
  it("returns empty string for null", () => {
    expect(getTextFromChildren(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(getTextFromChildren(undefined)).toBe("");
  });

  it("returns the string as-is for string children", () => {
    expect(getTextFromChildren("Hello World")).toBe("Hello World");
  });

  it("converts numbers to strings", () => {
    expect(getTextFromChildren(123)).toBe("123");
  });

  it("joins array children", () => {
    expect(getTextFromChildren(["Hello", " ", "World"])).toBe("Hello World");
  });

  it("extracts text from React elements", () => {
    const element = createElement("span", null, "Hello");
    expect(getTextFromChildren(element)).toBe("Hello");
  });

  it("extracts text from nested React elements", () => {
    const element = createElement(
      "div",
      null,
      createElement("span", null, "Hello"),
      " ",
      createElement("strong", null, "World"),
    );
    expect(getTextFromChildren(element)).toBe("Hello World");
  });

  it("handles mixed content", () => {
    const element = createElement(
      "div",
      null,
      "Text ",
      createElement("code", null, "code"),
      " more text",
    );
    expect(getTextFromChildren(element)).toBe("Text code more text");
  });

  it("handles deeply nested elements", () => {
    const element = createElement(
      "div",
      null,
      createElement(
        "span",
        null,
        createElement("strong", null, createElement("em", null, "Deep")),
      ),
    );
    expect(getTextFromChildren(element)).toBe("Deep");
  });
});
