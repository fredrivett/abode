import { describe, expect, test } from "vitest";
import {
  buildTitleContextParts,
  buildTitlePrompt,
  processAITitle,
} from "./vision";

describe("buildTitleContextParts", () => {
  test("returns empty array when no context is provided", () => {
    const result = buildTitleContextParts({
      labels: [],
      objects: [],
      ocrText: null,
    });

    expect(result).toEqual([]);
  });

  test("includes original filename when provided", () => {
    const result = buildTitleContextParts({
      originalFilename: "IMG_20240101_sunset.jpg",
      labels: [],
      objects: [],
      ocrText: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("Original filename: IMG_20240101_sunset.jpg");
  });

  test("includes labels (limited to 10)", () => {
    const result = buildTitleContextParts({
      labels: ["nature", "mountain", "sky", "landscape"],
      objects: [],
      ocrText: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      "Detected labels/themes: nature, mountain, sky, landscape",
    );
  });

  test("limits labels to first 10", () => {
    const manyLabels = Array.from({ length: 15 }, (_, i) => `label${i}`);

    const result = buildTitleContextParts({
      labels: manyLabels,
      objects: [],
      ocrText: null,
    });

    expect(result[0]).toContain("label0");
    expect(result[0]).toContain("label9");
    expect(result[0]).not.toContain("label10");
  });

  test("includes objects", () => {
    const result = buildTitleContextParts({
      labels: [],
      objects: ["Mountain", "Tree", "Person"],
      ocrText: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("Detected objects: Mountain, Tree, Person");
  });

  test("includes OCR text", () => {
    const result = buildTitleContextParts({
      labels: [],
      objects: [],
      ocrText: "Welcome to California",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("Text in image: Welcome to California");
  });

  test("truncates long OCR text to 200 characters", () => {
    const longText = "A".repeat(300);

    const result = buildTitleContextParts({
      labels: [],
      objects: [],
      ocrText: longText,
    });

    expect(result[0]).toContain("A".repeat(200));
    expect(result[0]).toContain("...");
    expect(result[0]).toBe(`Text in image: ${"A".repeat(200)}...`);
  });

  test("does not add ellipsis for OCR text exactly 200 chars", () => {
    const exactText = "A".repeat(200);

    const result = buildTitleContextParts({
      labels: [],
      objects: [],
      ocrText: exactText,
    });

    expect(result[0]).toBe(`Text in image: ${"A".repeat(200)}`);
    expect(result[0]).not.toContain("...");
  });

  test("includes all context parts when all provided", () => {
    const result = buildTitleContextParts({
      originalFilename: "photo.jpg",
      labels: ["nature", "outdoor"],
      objects: ["Tree"],
      ocrText: "Hello World",
    });

    expect(result).toHaveLength(4);
    expect(result[0]).toBe("Original filename: photo.jpg");
    expect(result[1]).toBe("Detected labels/themes: nature, outdoor");
    expect(result[2]).toBe("Detected objects: Tree");
    expect(result[3]).toBe("Text in image: Hello World");
  });
});

describe("buildTitlePrompt", () => {
  test("builds prompt with context parts", () => {
    const contextParts = [
      "Original filename: photo.jpg",
      "Detected objects: Tree",
    ];

    const prompt = buildTitlePrompt(contextParts);

    expect(prompt).toContain("2-6 words");
    expect(prompt).toContain("Original filename: photo.jpg");
    expect(prompt).toContain("Detected objects: Tree");
    expect(prompt).toContain("Respond with ONLY the title");
  });

  test("joins multiple context parts with newlines", () => {
    const contextParts = ["Part 1", "Part 2", "Part 3"];

    const prompt = buildTitlePrompt(contextParts);

    expect(prompt).toContain("Part 1\nPart 2\nPart 3");
  });
});

describe("processAITitle", () => {
  test("returns null for null input", () => {
    expect(processAITitle(null)).toBeNull();
  });

  test("returns null for undefined input", () => {
    expect(processAITitle(undefined)).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(processAITitle("")).toBeNull();
  });

  test("returns null for whitespace-only string", () => {
    expect(processAITitle("   \n\t  ")).toBeNull();
  });

  test("trims whitespace from title", () => {
    expect(processAITitle("  Beach Photo  \n")).toBe("Beach Photo");
  });

  test("returns title as-is when under 80 characters", () => {
    const title = "Beautiful Mountain Landscape";
    expect(processAITitle(title)).toBe(title);
  });

  test("returns title exactly 80 characters without truncation", () => {
    const title = "A".repeat(80);
    expect(processAITitle(title)).toBe(title);
  });

  test("truncates title over 80 characters", () => {
    const longTitle = "A".repeat(100);

    const result = processAITitle(longTitle);

    expect(result).toBe(`${"A".repeat(77)}...`);
    expect(result?.length).toBe(80);
  });
});
