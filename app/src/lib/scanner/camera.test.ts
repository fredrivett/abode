import { afterEach, describe, expect, it, vi } from "vitest";
import { cameraErrorReason, isCameraSupported, supportsTorch } from "./camera";

const namedError = (name: string) =>
  Object.assign(new Error("camera failed"), { name });

describe("cameraErrorReason", () => {
  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "unavailable"],
    ["NotReadableError", "unavailable"],
  ])("maps %s to %s", (name, reason) => {
    expect(cameraErrorReason(namedError(name))).toBe(reason);
  });

  it("treats unknown throwables as unavailable", () => {
    expect(cameraErrorReason("nope")).toBe("unavailable");
  });
});

describe("isCameraSupported", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is false without mediaDevices (e.g. insecure context)", () => {
    vi.stubGlobal("navigator", {});
    expect(isCameraSupported()).toBe(false);
  });

  it("is true when getUserMedia exists", () => {
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
    expect(isCameraSupported()).toBe(true);
  });
});

describe("supportsTorch", () => {
  const track = (capabilities: object | undefined) => ({
    getCapabilities: capabilities ? () => capabilities : undefined,
  });

  it("is true when the track advertises a torch", () => {
    expect(supportsTorch(track({ torch: true }))).toBe(true);
  });

  it("is false without the capability or the API", () => {
    expect(supportsTorch(track({}))).toBe(false);
    expect(supportsTorch(track(undefined))).toBe(false);
  });
});
