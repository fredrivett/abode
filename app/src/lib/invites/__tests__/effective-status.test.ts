import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ systemDb: {} }));

import { getEffectiveStatus } from "../index";

const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);

describe("getEffectiveStatus", () => {
  it("reports a pending invite by its expiry", () => {
    expect(getEffectiveStatus({ status: "pending", expiresAt: FUTURE })).toBe(
      "pending",
    );
    expect(getEffectiveStatus({ status: "pending", expiresAt: PAST })).toBe(
      "expired",
    );
  });

  it("keeps a used invite's status once its expiry passes", () => {
    expect(getEffectiveStatus({ status: "accepted", expiresAt: PAST })).toBe(
      "accepted",
    );
    // The recipient joined through a sibling invite; this one never reads as
    // expired or still open
    expect(
      getEffectiveStatus({ status: "joined_elsewhere", expiresAt: PAST }),
    ).toBe("joined_elsewhere");
    expect(
      getEffectiveStatus({ status: "joined_elsewhere", expiresAt: FUTURE }),
    ).toBe("joined_elsewhere");
  });
});
