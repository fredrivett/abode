import { describe, expect, it } from "vitest";
import { waitlistSchema } from "./schema";

describe("waitlistSchema", () => {
  it("accepts an email with an optional referralSource", () => {
    expect(waitlistSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
    expect(
      waitlistSchema.safeParse({ email: "a@b.com", referralSource: "twitter" })
        .success,
    ).toBe(true);
  });

  it("rejects a missing or empty email", () => {
    expect(waitlistSchema.safeParse({}).success).toBe(false);
    expect(waitlistSchema.safeParse({ email: "" }).success).toBe(false);
  });

  it("rejects a non-string email", () => {
    expect(waitlistSchema.safeParse({ email: 123 }).success).toBe(false);
    expect(waitlistSchema.safeParse({ email: null }).success).toBe(false);
  });

  it("rejects a non-string referralSource", () => {
    expect(
      waitlistSchema.safeParse({ email: "a@b.com", referralSource: 5 }).success,
    ).toBe(false);
  });
});
