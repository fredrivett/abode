import { beforeEach, describe, expect, it, vi } from "vitest";

// completeSignup touches Prisma (@/lib/db), the invite lib, and Trigger.dev.
// Mock all three so this stays a fast unit test focused on the invite gate.
const {
  mockUserUpdate,
  mockInviteFindUnique,
  mockAcceptInvite,
  mockTrigger,
  mockSaveSharedItem,
} = vi.hoisted(() => ({
  mockUserUpdate: vi.fn(),
  mockInviteFindUnique: vi.fn(),
  mockAcceptInvite: vi.fn(),
  mockTrigger: vi.fn(),
  mockSaveSharedItem: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    user: { update: mockUserUpdate },
    invite: { findUnique: mockInviteFindUnique },
  },
}));

vi.mock("@/lib/invites", () => ({
  acceptInvite: mockAcceptInvite,
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
}));

vi.mock("@/lib/invites/share-invite", () => ({
  saveSharedItemForNewUser: mockSaveSharedItem,
}));

const pendingInvite = {
  id: "invite-1",
  email: "invited@example.com",
  origin: "user",
  status: "pending",
  inviterId: "inviter-1",
  expiresAt: new Date(Date.now() + 60_000),
  inviter: { username: "host", email: "host@example.com" },
};

vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: mockTrigger } }));

import { completeSignup } from "./complete-signup";

describe("completeSignup (invite-only gate)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserUpdate.mockResolvedValue({});
    mockTrigger.mockResolvedValue(undefined);
  });

  it("rejects completion when no invite token is present", async () => {
    const result = await completeSignup({
      userId: "user-1",
      email: "orphan@example.com",
      username: "orphan",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("INVITE_REQUIRED");
    }
    // No account mutation and no downstream jobs on the reject path
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("completes signup when a valid invite token is present", async () => {
    mockInviteFindUnique.mockResolvedValue({
      id: "invite-1",
      email: "invited@example.com",
      origin: "user",
      status: "pending",
      inviterId: "inviter-1",
      expiresAt: new Date(Date.now() + 60_000),
      inviter: { username: "host", email: "host@example.com" },
    });
    mockAcceptInvite.mockResolvedValue({ success: true });

    const result = await completeSignup({
      userId: "user-2",
      email: "invited@example.com",
      username: "invited",
      inviteToken: "tok_valid",
    });

    expect(result.success).toBe(true);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-2" } }),
    );
    expect(mockAcceptInvite).toHaveBeenCalledWith("tok_valid", "user-2");
  });

  it("does not finalize the account when the invite claim fails (lost race)", async () => {
    mockInviteFindUnique.mockResolvedValue({
      id: "invite-1",
      email: "invited@example.com",
      origin: "user",
      status: "pending",
      inviterId: "inviter-1",
      expiresAt: new Date(Date.now() + 60_000),
      inviter: { username: "host", email: "host@example.com" },
    });
    // acceptInvite lost the concurrent claim
    mockAcceptInvite.mockResolvedValue({
      success: false,
      error: "Invite already accepted",
      code: "ALREADY_ACCEPTED",
    });

    const result = await completeSignup({
      userId: "user-4",
      email: "invited@example.com",
      username: "invited",
      inviteToken: "tok_raced",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("ALREADY_ACCEPTED");
    }
    // Account must NOT be finalized when the claim fails
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("rejects when the invite token does not exist", async () => {
    mockInviteFindUnique.mockResolvedValue(null);

    const result = await completeSignup({
      userId: "user-3",
      email: "invited@example.com",
      username: "invited",
      inviteToken: "tok_missing",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("INVALID_TOKEN");
    }
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("rejects a pending invite used by a different email", async () => {
    // Share invites hand tokens to whoever asked, so a token must only ever
    // complete for the address it was issued to
    mockInviteFindUnique.mockResolvedValue(pendingInvite);

    const result = await completeSignup({
      userId: "user-5",
      email: "someone-else@example.com",
      username: "sneaky",
      inviteToken: "tok_valid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("INVITE_EMAIL_MISMATCH");
    }
    expect(mockAcceptInvite).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("matches the invite email case-insensitively", async () => {
    mockInviteFindUnique.mockResolvedValue(pendingInvite);
    mockAcceptInvite.mockResolvedValue({ success: true });

    const result = await completeSignup({
      userId: "user-6",
      email: "Invited@Example.com",
      username: "invited",
      inviteToken: "tok_valid",
    });

    expect(result.success).toBe(true);
  });

  it("saves the shared item after completing signup from a share invite", async () => {
    mockInviteFindUnique.mockResolvedValue(pendingInvite);
    mockAcceptInvite.mockResolvedValue({ success: true });
    mockSaveSharedItem.mockResolvedValue("new-item-1");

    const result = await completeSignup({
      userId: "user-7",
      email: "invited@example.com",
      username: "invited",
      inviteToken: "tok_valid",
      saveItemId: "shared-item-1",
    });

    expect(mockSaveSharedItem).toHaveBeenCalledWith({
      userId: "user-7",
      itemId: "shared-item-1",
    });
    expect(result).toEqual({ success: true, savedItemId: "new-item-1" });
  });

  it("still completes signup when saving the shared item doesn't happen", async () => {
    mockInviteFindUnique.mockResolvedValue(pendingInvite);
    mockAcceptInvite.mockResolvedValue({ success: true });
    mockSaveSharedItem.mockResolvedValue(null);

    const result = await completeSignup({
      userId: "user-8",
      email: "invited@example.com",
      username: "invited",
      inviteToken: "tok_valid",
      saveItemId: "gone-item",
    });

    expect(result).toEqual({ success: true });
  });

  it("doesn't try to save anything without a shared item", async () => {
    mockInviteFindUnique.mockResolvedValue(pendingInvite);
    mockAcceptInvite.mockResolvedValue({ success: true });

    await completeSignup({
      userId: "user-9",
      email: "invited@example.com",
      username: "invited",
      inviteToken: "tok_valid",
    });

    expect(mockSaveSharedItem).not.toHaveBeenCalled();
  });
});
