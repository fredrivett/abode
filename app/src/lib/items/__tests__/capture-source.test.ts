/// <reference types="vitest/globals" />

import { captureSourceLabel, isItemSource } from "../capture-source";

describe("isItemSource", () => {
  test.each(["web", "share_target", "extension"])(
    "accepts the valid source %s",
    (value) => {
      expect(isItemSource(value)).toBe(true);
    },
  );

  // `api` is a real CaptureSource but only ever stamped server-side
  test.each([null, undefined, "", "twitter", "WEB", "api", 42, {}])(
    "rejects the invalid value %p",
    (value) => {
      expect(isItemSource(value)).toBe(false);
    },
  );
});

describe("captureSourceLabel", () => {
  test.each([
    ["web", "Web"],
    ["share_target", "Shared"],
    ["extension", "Extension"],
    ["api", "API"],
  ] as const)("labels %s as %s", (source, label) => {
    expect(captureSourceLabel(source)).toBe(label);
  });
});
