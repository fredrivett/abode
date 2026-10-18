import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  itemFindUnique: vi.fn(),
  itemFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  waitlistFindUnique: vi.fn(),
  createUserInvite: vi.fn(),
  getAvailableInvites: vi.fn(),
  joinWaitlist: vi.fn(),
  isEmailConfigured: vi.fn(),
  sendEmail: vi.fn(),
  createItemFromUrl: vi.fn(),
  guardDailyLimit: vi.fn(),
  captureServerException: vi.fn(),
  getUserInviteEmail: vi.fn(() => ({ subject: "s", text: "t", html: "h" })),
}));

vi.mock("@/lib/db", () => {
  // Only the system connection: using the user's `db` here would be a bug
  const client = {
    item: {
      findUnique: mocks.itemFindUnique,
      findFirst: mocks.itemFindFirst,
    },
    user: { findUnique: mocks.userFindUnique },
    waitlistEntry: { findUnique: mocks.waitlistFindUnique },
  };
  return { systemDb: client };
});
vi.mock("@/lib/invites", () => ({
  createUserInvite: mocks.createUserInvite,
  getAvailableInvites: mocks.getAvailableInvites,
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
  validateEmail: (email: string) =>
    email.includes("@")
      ? { valid: true }
      : { valid: false, error: "Invalid email format" },
}));
vi.mock("@/lib/waitlist", () => ({ joinWaitlist: mocks.joinWaitlist }));
vi.mock("@/lib/email", () => ({
  EmailBlockedInTestError: class extends Error {},
  isEmailConfigured: mocks.isEmailConfigured,
  sendEmail: mocks.sendEmail,
}));
vi.mock("@/lib/email/templates", () => ({
  getUserInviteEmail: mocks.getUserInviteEmail,
}));
vi.mock("@/lib/items/from-url", () => ({
  createItemFromUrl: mocks.createItemFromUrl,
}));
vi.mock("@/lib/usage-limits", () => ({
  guardDailyLimit: mocks.guardDailyLimit,
}));
vi.mock("@/lib/posthog-server", () => ({
  captureServerException: mocks.captureServerException,
}));

import {
  requestShareInvite,
  saveSharedItemForNewUser,
  shareInvitesOpen,
  shareJoinPath,
  shareReferralSource,
} from "../share-invite";

const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const SHARER_ID = "33333333-3333-4333-8333-333333333333";

function sharedItem(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    title: "Good design",
    sourceUrl: "https://example.com/good-design",
    userId: SHARER_ID,
    sharedAt: new Date(),
    excludeFromPublicRooms: false,
    roomItems: [],
    user: {
      id: SHARER_ID,
      username: "fred",
      firstName: "Fred",
      lastName: null,
      allowShareInvites: true,
    },
    ...overrides,
  };
}

const request = (email = "reader@example.com") =>
  requestShareInvite({ itemId: ITEM_ID, email });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.itemFindUnique.mockResolvedValue(sharedItem());
  mocks.userFindUnique.mockResolvedValue(null);
  mocks.waitlistFindUnique.mockResolvedValue(null);
  mocks.isEmailConfigured.mockReturnValue(true);
  mocks.sendEmail.mockResolvedValue({ success: true });
  mocks.joinWaitlist.mockResolvedValue({ success: true, position: 7 });
  mocks.guardDailyLimit.mockResolvedValue({ ok: true });
  mocks.itemFindFirst.mockResolvedValue(null);
});

describe("helpers", () => {
  it("credits the sharer in the waitlist referral source", () => {
    expect(shareReferralSource("fred")).toBe("share:@fred");
    expect(shareReferralSource(null)).toBe("share");
  });

  it("builds a join path carrying the item to save", () => {
    expect(shareJoinPath({ token: "tok_1", itemId: ITEM_ID })).toBe(
      `/join?token=tok_1&save=${ITEM_ID}`,
    );
  });
});

describe("requestShareInvite", () => {
  it("creates an invite from the sharer and returns the join path", async () => {
    mocks.createUserInvite.mockResolvedValue({
      success: true,
      invite: { token: "tok_1" },
    });

    expect(await request("Reader@Example.com")).toEqual({
      status: "invited",
      joinPath: `/join?token=tok_1&save=${ITEM_ID}`,
    });
    expect(mocks.createUserInvite).toHaveBeenCalledWith(
      SHARER_ID,
      "reader@example.com",
    );
    // Backup email so they can come back to the invite later — with the
    // item, so returning through it still saves it
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "reader@example.com" }),
    );
    expect(mocks.getUserInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ inviteToken: "tok_1", saveItemId: ITEM_ID }),
    );
  });

  it("still returns the join path when the backup email fails", async () => {
    mocks.createUserInvite.mockResolvedValue({
      success: true,
      invite: { token: "tok_1" },
    });
    mocks.sendEmail.mockResolvedValue({ success: false, error: "boom" });

    expect((await request()).status).toBe("invited");
  });

  it("still returns the join path when sending the email throws", async () => {
    mocks.createUserInvite.mockResolvedValue({
      success: true,
      invite: { token: "tok_1" },
    });
    mocks.sendEmail.mockRejectedValue(new Error("resend down"));

    expect((await request()).status).toBe("invited");
  });

  it("skips the email when email isn't configured", async () => {
    mocks.createUserInvite.mockResolvedValue({
      success: true,
      invite: { token: "tok_1" },
    });
    mocks.isEmailConfigured.mockReturnValue(false);

    await request();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("waitlists, credited to the sharer, when they're out of invites", async () => {
    mocks.createUserInvite.mockResolvedValue({
      success: false,
      code: "NO_INVITES_REMAINING",
      error: "No invites",
    });

    expect(await request()).toEqual({ status: "waitlisted" });
    expect(mocks.joinWaitlist).toHaveBeenCalledWith({
      email: "reader@example.com",
      referralSource: "share:@fred",
      source: "share",
    });
  });

  it("passes the reader's PostHog id on to the waitlist join", async () => {
    mocks.createUserInvite.mockResolvedValue({
      success: false,
      code: "NO_INVITES_REMAINING",
      error: "No invites",
    });

    await requestShareInvite({
      itemId: ITEM_ID,
      email: "reader@example.com",
      distinctId: "anon-reader-1",
    });

    expect(mocks.joinWaitlist).toHaveBeenCalledWith(
      expect.objectContaining({ source: "share", distinctId: "anon-reader-1" }),
    );
  });

  it("waitlists without spending an invite when the sharer opted out", async () => {
    mocks.itemFindUnique.mockResolvedValue(
      sharedItem({
        user: { ...sharedItem().user, allowShareInvites: false },
      }),
    );

    expect(await request()).toEqual({ status: "waitlisted" });
    expect(mocks.createUserInvite).not.toHaveBeenCalled();
  });

  it("treats an email already on the waitlist as waitlisted", async () => {
    mocks.createUserInvite.mockResolvedValue({
      success: false,
      code: "NO_INVITES_REMAINING",
      error: "No invites",
    });
    mocks.waitlistFindUnique.mockResolvedValue({ id: "entry-1" });

    expect(await request()).toEqual({ status: "waitlisted" });
    expect(mocks.joinWaitlist).not.toHaveBeenCalled();
  });

  it("sends existing users to log in without creating an invite", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1" });

    expect(await request()).toEqual({ status: "has_account" });
    expect(mocks.createUserInvite).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    expect(await request("nope")).toEqual({
      status: "invalid_email",
      error: "Invalid email format",
    });
  });

  it("surfaces waitlist validation errors", async () => {
    mocks.createUserInvite.mockResolvedValue({
      success: false,
      code: "NO_INVITES_REMAINING",
      error: "No invites",
    });
    mocks.joinWaitlist.mockResolvedValue({
      success: false,
      error: "Please use a permanent email address",
    });

    expect(await request()).toEqual({
      status: "invalid_email",
      error: "Please use a permanent email address",
    });
  });

  it("is unavailable for items that aren't publicly viewable", async () => {
    mocks.itemFindUnique.mockResolvedValue(sharedItem({ sharedAt: null }));

    expect(await request()).toEqual({ status: "unavailable" });
    expect(mocks.createUserInvite).not.toHaveBeenCalled();
    expect(mocks.joinWaitlist).not.toHaveBeenCalled();
  });

  it("is unavailable for a non-uuid item id without querying", async () => {
    expect(
      await requestShareInvite({ itemId: "nope", email: "a@b.co" }),
    ).toEqual({ status: "unavailable" });
    expect(mocks.itemFindUnique).not.toHaveBeenCalled();
  });
});

describe("shareInvitesOpen", () => {
  it("is open only when allowed and an invite is left", async () => {
    mocks.getAvailableInvites.mockResolvedValue(2);
    expect(
      await shareInvitesOpen({ id: SHARER_ID, allowShareInvites: true }),
    ).toBe(true);

    mocks.getAvailableInvites.mockResolvedValue(0);
    expect(
      await shareInvitesOpen({ id: SHARER_ID, allowShareInvites: true }),
    ).toBe(false);
  });

  it("is closed when the sharer opted out, without counting invites", async () => {
    expect(
      await shareInvitesOpen({ id: SHARER_ID, allowShareInvites: false }),
    ).toBe(false);
    expect(mocks.getAvailableInvites).not.toHaveBeenCalled();
  });
});

describe("saveSharedItemForNewUser", () => {
  const save = () =>
    saveSharedItemForNewUser({ userId: "new-user", itemId: ITEM_ID });

  it("saves the shared item's link for the new user", async () => {
    mocks.createItemFromUrl.mockResolvedValue({ id: "new-item" });

    expect(await save()).toBe("new-item");
    expect(mocks.createItemFromUrl).toHaveBeenCalledWith({
      userId: "new-user",
      url: "https://example.com/good-design",
      source: "web",
    });
  });

  it("reuses the item it already saved instead of saving twice", async () => {
    // e.g. the confirmation link opened twice
    mocks.itemFindFirst.mockResolvedValue({ id: "already-saved" });

    expect(await save()).toBe("already-saved");
    expect(mocks.createItemFromUrl).not.toHaveBeenCalled();
  });

  it("skips items that are no longer public", async () => {
    mocks.itemFindUnique.mockResolvedValue(sharedItem({ sharedAt: null }));
    expect(await save()).toBeNull();
    expect(mocks.createItemFromUrl).not.toHaveBeenCalled();
  });

  it("skips items without a link to save", async () => {
    mocks.itemFindUnique.mockResolvedValue(sharedItem({ sourceUrl: null }));
    expect(await save()).toBeNull();
  });

  it("respects the daily ingestion limit", async () => {
    mocks.guardDailyLimit.mockResolvedValue({ ok: false });
    expect(await save()).toBeNull();
    expect(mocks.createItemFromUrl).not.toHaveBeenCalled();
  });

  it("returns null instead of throwing when saving fails", async () => {
    mocks.createItemFromUrl.mockRejectedValue(new Error("queue down"));
    expect(await save()).toBeNull();
    expect(mocks.captureServerException).toHaveBeenCalled();
  });
});
