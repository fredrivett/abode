import { describe, expect, it } from "vitest";
import { isScannerResponseMessage } from "./protocol";

const quad = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 10, y: 0 },
  bottomRight: { x: 10, y: 10 },
  bottomLeft: { x: 0, y: 10 },
};

describe("isScannerResponseMessage", () => {
  it.each([
    { id: 1, type: "init", detector: "ml" },
    { id: 1, type: "init", detector: "classical" },
    { id: 2, type: "detect", detection: { quad, score: 0.9 } },
    { id: 2, type: "detect", detection: { quad: null, score: null } },
    { id: 3, type: "capture", source: new Blob(), quad },
    { id: 3, type: "capture", source: new Blob(), quad: null },
    { id: 4, type: "render", blob: new Blob(), width: 10, height: 20 },
    { id: 5, type: "error", message: "boom" },
  ])("accepts $type response", (message) => {
    expect(isScannerResponseMessage(message)).toBe(true);
  });

  it.each([
    ["non-objects", "init"],
    ["a missing id", { type: "init", detector: "ml" }],
    ["an unknown type", { id: 1, type: "nope" }],
    ["an unknown detector", { id: 1, type: "init", detector: "gpu" }],
    ["a malformed quad", { id: 2, type: "detect", detection: { quad: {} } }],
    ["a capture without a blob", { id: 3, type: "capture", source: "x", quad }],
    [
      "a render without dimensions",
      { id: 4, type: "render", blob: new Blob() },
    ],
    ["an error without a message", { id: 5, type: "error" }],
  ])("rejects %s", (_label, message) => {
    expect(isScannerResponseMessage(message)).toBe(false);
  });
});
