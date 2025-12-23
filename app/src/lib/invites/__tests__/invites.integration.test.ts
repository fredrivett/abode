/// <reference types="vitest/globals" />
import { resetTestDatabase } from "@app/vitest.setup.db";

describe("Invites Integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("getAvailableInvites", () => {
    it("returns full allocation when no invites sent", async () => {
      const { write } = await import("@/lib/db");
      const { getAvailableInvites } = await import("@/lib/invites");

      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440001",
          email: "inviter@example.com",
          inviteAllocation: 3,
        },
      });

      const available = await getAvailableInvites(user.id);
      expect(available).toBe(3);
    });

    it("subtracts accepted invites from allocation", async () => {
      const { write } = await import("@/lib/db");
      const { getAvailableInvites } = await import("@/lib/invites");

      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440002",
          email: "inviter@example.com",
          inviteAllocation: 3,
        },
      });

      // Create an accepted invite
      await write.invite.create({
        data: {
          email: "invited@example.com",
          token: "accepted-token-123",
          type: "user",
          status: "accepted",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          inviterId: user.id,
          acceptedAt: new Date(),
        },
      });

      const available = await getAvailableInvites(user.id);
      expect(available).toBe(2);
    });

    it("subtracts active pending invites from allocation", async () => {
      const { write } = await import("@/lib/db");
      const { getAvailableInvites } = await import("@/lib/invites");

      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440003",
          email: "inviter@example.com",
          inviteAllocation: 3,
        },
      });

      // Create an active pending invite (not expired)
      await write.invite.create({
        data: {
          email: "invited@example.com",
          token: "pending-token-123",
          type: "user",
          status: "pending",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          inviterId: user.id,
        },
      });

      const available = await getAvailableInvites(user.id);
      expect(available).toBe(2);
    });

    it("does not count expired pending invites", async () => {
      const { write } = await import("@/lib/db");
      const { getAvailableInvites } = await import("@/lib/invites");

      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440004",
          email: "inviter@example.com",
          inviteAllocation: 3,
        },
      });

      // Create an expired pending invite
      await write.invite.create({
        data: {
          email: "invited@example.com",
          token: "expired-token-123",
          type: "user",
          status: "pending",
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
          inviterId: user.id,
        },
      });

      const available = await getAvailableInvites(user.id);
      expect(available).toBe(3); // Expired invite doesn't count
    });

    it("returns 0 for non-existent user", async () => {
      const { getAvailableInvites } = await import("@/lib/invites");

      // Use a valid UUID format that doesn't exist in the database
      const available = await getAvailableInvites(
        "550e8400-e29b-41d4-a716-999999999999",
      );
      expect(available).toBe(0);
    });
  });

  describe("createUserInvite", () => {
    it("creates invite for valid email", async () => {
      const { write } = await import("@/lib/db");
      const { createUserInvite } = await import("@/lib/invites");

      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440010",
          email: "inviter@example.com",
          inviteAllocation: 3,
        },
      });

      const result = await createUserInvite(user.id, "friend@example.com");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.invite.email).toBe("friend@example.com");
        expect(result.invite.type).toBe("user");
        expect(result.invite.inviterId).toBe(user.id);
      }
    });

    it("returns error for disposable email", async () => {
      const { write } = await import("@/lib/db");
      const { createUserInvite } = await import("@/lib/invites");

      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440011",
          email: "inviter@example.com",
          inviteAllocation: 3,
        },
      });

      // mailinator.com is a known disposable email domain
      const result = await createUserInvite(user.id, "test@mailinator.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_EMAIL");
      }
    });

    it("returns error when no invites remaining", async () => {
      const { write } = await import("@/lib/db");
      const { createUserInvite } = await import("@/lib/invites");

      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440012",
          email: "inviter@example.com",
          inviteAllocation: 0,
        },
      });

      const result = await createUserInvite(user.id, "friend@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("NO_INVITES_REMAINING");
      }
    });

    it("refreshes existing pending invite instead of creating new", async () => {
      const { write, read } = await import("@/lib/db");
      const { createUserInvite } = await import("@/lib/invites");

      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440013",
          email: "inviter@example.com",
          inviteAllocation: 3,
        },
      });

      // First invite
      const result1 = await createUserInvite(user.id, "friend@example.com");
      expect(result1.success).toBe(true);
      const firstToken = result1.success ? result1.invite.token : "";

      // Re-send invite to same email
      const result2 = await createUserInvite(user.id, "friend@example.com");
      expect(result2.success).toBe(true);
      if (result2.success) {
        // Should have new token
        expect(result2.invite.token).not.toBe(firstToken);
        // Should have incremented sendCount
        expect(result2.invite.sendCount).toBe(2);
      }

      // Should only have one invite record
      const invites = await read.invite.findMany({
        where: { inviterId: user.id },
      });
      expect(invites).toHaveLength(1);
    });

    it("returns error for already accepted invite", async () => {
      const { write } = await import("@/lib/db");
      const { createUserInvite } = await import("@/lib/invites");

      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440014",
          email: "inviter@example.com",
          inviteAllocation: 3,
        },
      });

      // Create accepted invite
      await write.invite.create({
        data: {
          email: "friend@example.com",
          token: "accepted-token",
          type: "user",
          status: "accepted",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          inviterId: user.id,
          acceptedAt: new Date(),
        },
      });

      const result = await createUserInvite(user.id, "friend@example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("ALREADY_JOINED");
      }
    });
  });

  describe("acceptInvite", () => {
    it("marks pending invite as accepted", async () => {
      const { write, read } = await import("@/lib/db");
      const { acceptInvite } = await import("@/lib/invites");

      await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440020",
          email: "inviter@example.com",
        },
      });

      const invite = await write.invite.create({
        data: {
          email: "invited@example.com",
          token: "valid-token-123",
          type: "user",
          status: "pending",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          inviterId: "550e8400-e29b-41d4-a716-446655440020",
        },
      });

      const result = await acceptInvite(invite.token);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.invite.status).toBe("accepted");
        expect(result.invite.acceptedAt).not.toBeNull();
      }

      // Verify in database
      const updatedInvite = await read.invite.findUnique({
        where: { token: invite.token },
      });
      expect(updatedInvite?.status).toBe("accepted");
    });

    it("returns error for already accepted invite", async () => {
      const { write } = await import("@/lib/db");
      const { acceptInvite } = await import("@/lib/invites");

      await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440021",
          email: "inviter@example.com",
        },
      });

      await write.invite.create({
        data: {
          email: "invited@example.com",
          token: "already-accepted-token",
          type: "user",
          status: "accepted",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          inviterId: "550e8400-e29b-41d4-a716-446655440021",
          acceptedAt: new Date(),
        },
      });

      const result = await acceptInvite("already-accepted-token");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("ALREADY_ACCEPTED");
      }
    });

    it("returns error for expired invite", async () => {
      const { write } = await import("@/lib/db");
      const { acceptInvite } = await import("@/lib/invites");

      await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440022",
          email: "inviter@example.com",
        },
      });

      await write.invite.create({
        data: {
          email: "invited@example.com",
          token: "expired-token",
          type: "user",
          status: "pending",
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
          inviterId: "550e8400-e29b-41d4-a716-446655440022",
        },
      });

      const result = await acceptInvite("expired-token");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("EXPIRED");
      }
    });

    it("returns error for non-existent token", async () => {
      const { acceptInvite } = await import("@/lib/invites");

      const result = await acceptInvite("non-existent-token");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_TOKEN");
      }
    });
  });

  describe("validateInviteToken", () => {
    it("returns valid for pending non-expired invite", async () => {
      const { write } = await import("@/lib/db");
      const { validateInviteToken } = await import("@/lib/invites");

      await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440030",
          email: "inviter@example.com",
          username: "inviter",
        },
      });

      await write.invite.create({
        data: {
          email: "invited@example.com",
          token: "valid-pending-token",
          type: "user",
          status: "pending",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          inviterId: "550e8400-e29b-41d4-a716-446655440030",
        },
      });

      const result = await validateInviteToken("valid-pending-token");

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.invite.email).toBe("invited@example.com");
        expect(result.invite.inviter?.username).toBe("inviter");
      }
    });

    it("returns invalid for expired invite", async () => {
      const { write } = await import("@/lib/db");
      const { validateInviteToken } = await import("@/lib/invites");

      await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440031",
          email: "inviter@example.com",
        },
      });

      await write.invite.create({
        data: {
          email: "invited@example.com",
          token: "expired-validate-token",
          type: "user",
          status: "pending",
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          inviterId: "550e8400-e29b-41d4-a716-446655440031",
        },
      });

      const result = await validateInviteToken("expired-validate-token");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("EXPIRED");
      }
    });
  });
});
