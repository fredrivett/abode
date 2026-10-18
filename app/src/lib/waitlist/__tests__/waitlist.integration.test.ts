/// <reference types="vitest/globals" />
import { resetTestDatabase } from "@app/vitest.setup.db";

const capture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ captureImmediate: capture }),
  captureServerException: vi.fn(),
}));

// Email mock is provided globally by vitest.setup.db.ts

describe("Waitlist Integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    capture.mockReset();
  });

  describe("joinWaitlist", () => {
    it("adds valid email to waitlist with position", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");

      const result = await joinWaitlist({
        email: "test@example.com",
        source: "form",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.position).toBe(1);
      }
    });

    it("assigns sequential positions", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");

      const result1 = await joinWaitlist({
        email: "first@example.com",
        source: "form",
      });
      const result2 = await joinWaitlist({
        email: "second@example.com",
        source: "form",
      });
      const result3 = await joinWaitlist({
        email: "third@example.com",
        source: "form",
      });

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

      const result = await joinWaitlist({
        email: "not-an-email",
        source: "form",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("valid email");
      }
    });

    it("rejects disposable email domains", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");

      const result = await joinWaitlist({
        email: "test@mailinator.com",
        source: "form",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("permanent email");
      }
    });

    it("rejects duplicate email", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");

      await joinWaitlist({ email: "duplicate@example.com", source: "form" });
      const result = await joinWaitlist({
        email: "duplicate@example.com",
        source: "form",
      });

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

      const result = await joinWaitlist({
        email: "existing@example.com",
        source: "form",
      });

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

      const result = await joinWaitlist({
        email: "invited@example.com",
        source: "form",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("pending invite");
      }
    });

    it("stores referral source", async () => {
      const { read } = await import("@/lib/db");
      const { joinWaitlist } = await import("@/lib/waitlist");

      await joinWaitlist({
        email: "referred@example.com",
        referralSource: "twitter",
        source: "form",
      });

      const entry = await read.waitlistEntry.findUnique({
        where: { email: "referred@example.com" },
      });

      expect(entry?.referralSource).toBe("twitter");
    });

    it("normalizes email to lowercase", async () => {
      const { read } = await import("@/lib/db");
      const { joinWaitlist } = await import("@/lib/waitlist");

      await joinWaitlist({ email: "Test@EXAMPLE.com", source: "form" });

      const entry = await read.waitlistEntry.findUnique({
        where: { email: "test@example.com" },
      });

      expect(entry).not.toBeNull();
    });
  });

  describe("waitlist_joined tracking", () => {
    it("records the join against the visitor's PostHog id", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");

      await joinWaitlist({
        email: "tracked@example.com",
        source: "form",
        distinctId: "anon-visitor-1",
        sourcePath: "/compare/mymind",
      });

      expect(capture).toHaveBeenCalledTimes(1);
      expect(capture).toHaveBeenCalledWith({
        distinctId: "anon-visitor-1",
        event: "waitlist_joined",
        properties: { source: "form", source_path: "/compare/mymind" },
      });
    });

    it("still records a join without a visitor id, as a personless event", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");

      await joinWaitlist({ email: "blocked@example.com", source: "share" });

      expect(capture).toHaveBeenCalledTimes(1);
      const [{ distinctId, event, properties }] = capture.mock.calls[0];
      expect(event).toBe("waitlist_joined");
      expect(distinctId).toMatch(/^waitlist_/);
      expect(properties).toMatchObject({
        source: "share",
        $process_person_profile: false,
      });
    });

    it("never sends the email address", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");

      await joinWaitlist({ email: "private@example.com", source: "form" });

      expect(JSON.stringify(capture.mock.calls)).not.toContain(
        "private@example.com",
      );
    });

    it("doesn't record a rejected join", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");

      await joinWaitlist({ email: "not-an-email", source: "form" });
      expect(capture).not.toHaveBeenCalled();

      await joinWaitlist({ email: "dupe@example.com", source: "form" });
      capture.mockReset();
      await joinWaitlist({ email: "dupe@example.com", source: "form" });
      expect(capture).not.toHaveBeenCalled();
    });

    it("still joins when recording the event fails", async () => {
      const { joinWaitlist } = await import("@/lib/waitlist");
      capture.mockRejectedValueOnce(new Error("PostHog down"));

      const result = await joinWaitlist({
        email: "resilient@example.com",
        source: "form",
      });

      expect(result).toEqual({ success: true, position: 1 });
    });
  });

  describe("getWaitlistStats", () => {
    it("returns total count", async () => {
      const { joinWaitlist, getWaitlistStats } = await import("@/lib/waitlist");

      await joinWaitlist({ email: "one@example.com", source: "form" });
      await joinWaitlist({ email: "two@example.com", source: "form" });
      await joinWaitlist({ email: "three@example.com", source: "form" });

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
