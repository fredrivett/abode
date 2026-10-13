import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ default: {} }));
vi.mock("@/lib/url", () => ({ getAppBaseUrl: () => "https://abode.test" }));

import { getInviteUrl } from "../index";

describe("getInviteUrl", () => {
  it("links to the join page with the token", () => {
    expect(getInviteUrl("tok_1")).toBe("https://abode.test/join?token=tok_1");
  });

  it("carries a share invite's item through to signup", () => {
    expect(getInviteUrl("tok_1", { saveItemId: "item-1" })).toBe(
      "https://abode.test/join?token=tok_1&save=item-1",
    );
  });
});
