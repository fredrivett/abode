import { describe, expect, it } from "vitest";
import { inviteSchema } from "./schema";

describe("inviteSchema", () => {
  it("accepts a non-empty waitlistEntryId", () => {
    expect(inviteSchema.safeParse({ waitlistEntryId: "abc" }).success).toBe(
      true,
    );
  });

  it("rejects a missing or empty waitlistEntryId", () => {
    expect(inviteSchema.safeParse({}).success).toBe(false);
    expect(inviteSchema.safeParse({ waitlistEntryId: "" }).success).toBe(false);
  });

  it("rejects a non-string waitlistEntryId", () => {
    expect(inviteSchema.safeParse({ waitlistEntryId: 123 }).success).toBe(
      false,
    );
    expect(inviteSchema.safeParse({ waitlistEntryId: null }).success).toBe(
      false,
    );
  });
});
