import { describe, expect, test } from "vitest";
import { resolveEmailConfigured } from "./index";

// Email is an optional enhancement (graceful degradation — see AGENTS.md):
// dev always works via local Inbucket; other environments need a Resend key.
describe("resolveEmailConfigured", () => {
  test("configured in dev even without a key (routes to Inbucket)", () => {
    expect(
      resolveEmailConfigured({ isDevelopment: true, hasResendKey: false }),
    ).toBe(true);
  });

  test("configured outside dev when a key is present", () => {
    expect(
      resolveEmailConfigured({ isDevelopment: false, hasResendKey: true }),
    ).toBe(true);
  });

  test("NOT configured outside dev when the key is absent", () => {
    expect(
      resolveEmailConfigured({ isDevelopment: false, hasResendKey: false }),
    ).toBe(false);
  });
});
