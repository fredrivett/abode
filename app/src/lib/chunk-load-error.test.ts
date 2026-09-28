import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "./chunk-load-error";

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

describe("isChunkLoadError", () => {
  it("matches webpack's ChunkLoadError", () => {
    expect(
      isChunkLoadError(
        namedError("ChunkLoadError", "Loading chunk 8560 failed."),
      ),
    ).toBe(true);
  });

  it("matches chunk failures by message", () => {
    expect(isChunkLoadError(new Error("Loading CSS chunk 12 failed."))).toBe(
      true,
    );
    expect(
      isChunkLoadError(new Error("Failed to load chunk /_next/static/x.js")),
    ).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of null"))).toBe(
      false,
    );
    expect(isChunkLoadError("ChunkLoadError")).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
