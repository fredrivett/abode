import { describe, expect, it } from "vitest";
import { scannerHint } from "./scanner-hint";

const base = { ready: true, auto: true, capturing: false } as const;

describe("scannerHint", () => {
  it("shows capture progress above everything else", () => {
    expect(
      scannerHint({
        ...base,
        ready: false,
        status: "searching",
        capturing: true,
      }),
    ).toBe("Capturing…");
  });

  it("waits for the detector to load", () => {
    expect(scannerHint({ ...base, ready: false, status: "searching" })).toBe(
      "Getting ready…",
    );
  });

  it.each([
    { status: "searching", auto: true, hint: "Point the camera at a document" },
    { status: "too-small", auto: true, hint: "Move closer" },
    { status: "steady", auto: true, hint: "Hold steady" },
    { status: "locked", auto: true, hint: "Hold steady" },
    { status: "steady", auto: false, hint: "Tap to capture" },
  ] as const)("$status (auto=$auto) → $hint", ({ status, auto, hint }) => {
    expect(scannerHint({ ...base, status, auto })).toBe(hint);
  });
});
