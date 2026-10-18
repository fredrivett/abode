import { describe, expect, it } from "vitest";
import { shareInviteSchema } from "./schema";

const ITEM_ID = "22222222-2222-4222-8222-222222222222";

describe("shareInviteSchema", () => {
  it("accepts the reader's PostHog id", () => {
    expect(
      shareInviteSchema.parse({
        itemId: ITEM_ID,
        email: "a@b.com",
        distinctId: "0192-anon",
      }),
    ).toEqual({ itemId: ITEM_ID, email: "a@b.com", distinctId: "0192-anon" });
  });

  it("drops a malformed PostHog id instead of failing the request", () => {
    expect(
      shareInviteSchema.parse({
        itemId: ITEM_ID,
        email: "a@b.com",
        distinctId: "",
      }),
    ).toEqual({ itemId: ITEM_ID, email: "a@b.com" });
  });

  it("still requires the item and email", () => {
    expect(shareInviteSchema.safeParse({ email: "a@b.com" }).success).toBe(
      false,
    );
    expect(shareInviteSchema.safeParse({ itemId: ITEM_ID }).success).toBe(
      false,
    );
  });
});
