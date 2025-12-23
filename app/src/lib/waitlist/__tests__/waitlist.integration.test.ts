/// <reference types="vitest/globals" />
import { resetTestDatabase } from "@app/vitest.setup.db";

// Mock the email module to prevent actual email sending
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, id: "mock-id" }),
}));

describe("Waitlist Integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.clearAllMocks();
  });

  describe("joinWaitlist", () => {
    it("adds valid email to waitlist with position", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");

      const result = await joinWaitlist("test@example.com");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.position).toBe(1);
      }
    });

    it("assigns sequential positions", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");

      const result1 = await joinWaitlist("first@example.com");
      const result2 = await joinWaitlist("second@example.com");
      const result3 = await joinWaitlist("third@example.com");

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      if (result1.success && result2.success && result3.success) {
        expect(result1.position).toBe(1);
        expect(result2.position).toBe(2);
        expect(result3.position).toBe(3);
      }
    });

    it("rejects invalid email format", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");

      const result = await joinWaitlist("not-an-email");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("valid email");
      }
    });

    it("rejects disposable email domains", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");

      const result = await joinWaitlist("test@mailinator.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("permanent email");
      }
    });

    it("rejects duplicate email", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");

      await joinWaitlist("duplicate@example.com");
      const result = await joinWaitlist("duplicate@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("already on the waitlist");
      }
    });

    it("rejects email that already has an account", async () => {
      const { write } = await import("@/lib/db");
      const { joinWaitlist } = await import("@/lib/waitlist");

      await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440040",
          email: "existing@example.com",
        },
      });

      const result = await joinWaitlist("existing@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("already registered");
      }
    });

    it("rejects email with active invite", async () => {
      const { write } = await import("@/lib/db");
      const { joinWaitlist } = await import("@/lib/waitlist");

      await write.invite.create({
        data: {
          email: "invited@example.com",
          token: "active-invite-token",
          origin: "admin",
          status: "pending",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const result = await joinWaitlist("invited@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("pending invite");
      }
    });

    it("stores referral source", async () => {
      const { read } = await import("@/lib/db");
      const { joinWaitlist } = await import("@/lib/waitlist");

      await joinWaitlist("referred@example.com", "twitter");

      const entry = await read.waitlistEntry.findUnique({
        where: { email: "referred@example.com" },
      });

      expect(entry?.referralSource).toBe("twitter");
    });

    it("normalizes email to lowercase", async () => {
      const { read } = await import("@/lib/db");
      const { joinWaitlist } = await import("@/lib/waitlist");

      await joinWaitlist("Test@EXAMPLE.com");

      const entry = await read.waitlistEntry.findUnique({
        where: { email: "test@example.com" },
      });

      expect(entry).not.toBeNull();
    });
  });

  describe("getWaitlistStats", () => {
    it("returns total count", async () => {
      const { joinWaitlist, getWaitlistStats } = await import("@/lib/waitlist");

      await joinWaitlist("one@example.com");
      await joinWaitlist("two@example.com");
      await joinWaitlist("three@example.com");

      const stats = await getWaitlistStats();

      expect(stats.total).toBe(3);
    });

    it("returns recent signups count", async () => {
      const { write } = await import("@/lib/db");
      const { getWaitlistStats } = await import("@/lib/waitlist");

      // Create old entry
      await write.waitlistEntry.create({
        data: {
          email: "old@example.com",
          position: 1,
          createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        },
      });

      // Create recent entry
      await write.waitlistEntry.create({
        data: {
          email: "recent@example.com",
          position: 2,
          createdAt: new Date(), // Now
        },
      });

      const stats = await getWaitlistStats();

      expect(stats.total).toBe(2);
      expect(stats.recentSignups).toBe(1); // Only the recent one
    });
  });
});
