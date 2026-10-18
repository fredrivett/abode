import { beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  __loaded: true,
  get_distinct_id: vi.fn(() => "anon-visitor-1"),
  has_opted_out_capturing: vi.fn(() => false),
}));
vi.mock("posthog-js", () => ({ default: posthog }));

import { posthogVisitorId } from "./visitor-id";

beforeEach(() => {
  posthog.__loaded = true;
  posthog.has_opted_out_capturing.mockReturnValue(false);
});

describe("posthogVisitorId", () => {
  it("returns the visitor's id when PostHog is running", () => {
    expect(posthogVisitorId()).toBe("anon-visitor-1");
  });

  it("returns nothing when PostHog isn't loaded (e.g. blocked)", () => {
    posthog.__loaded = false;
    expect(posthogVisitorId()).toBeUndefined();
  });

  it("returns nothing when the visitor opted out of capturing", () => {
    posthog.has_opted_out_capturing.mockReturnValue(true);
    expect(posthogVisitorId()).toBeUndefined();
  });
});
