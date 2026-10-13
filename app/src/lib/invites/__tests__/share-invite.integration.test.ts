/// <reference types="vitest/globals" />
import { resetTestDatabase } from "@app/vitest.setup.db";

// Fire-and-forget Trigger.dev calls (admin notifications) must not reach the network
vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: vi.fn().mockResolvedValue(undefined) },
}));

const SHARER_ID = "550e8400-e29b-41d4-a716-446655440101";
const ITEM_ID = "550e8400-e29b-41d4-a716-446655440102";

async function createSharerWithItem({
  inviteAllocation = 1,
  allowShareInvites = true,
  shared = true,
}: {
  inviteAllocation?: number;
  allowShareInvites?: boolean;
  shared?: boolean;
} = {}) {
  const { write } = await import("@/lib/db");
  await write.user.create({
    data: {
      id: SHARER_ID,
      email: "sharer@example.com",
      username: "sharer",
      inviteAllocation,
      allowShareInvites,
    },
  });
  await write.item.create({
    data: {
      id: ITEM_ID,
      userId: SHARER_ID,
      kind: "article",
      sourceType: "url",
      sourceUrl: "https://example.com/good-design",
      processingStatus: "completed",
      sharedAt: shared ? new Date() : null,
    },
  });
}

describe("requestShareInvite (integration)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("spends one of the sharer's invites, then falls back to the waitlist", async () => {
    await createSharerWithItem({ inviteAllocation: 1 });
    const { read } = await import("@/lib/db");
    const { requestShareInvite } = await import("@/lib/invites/share-invite");
    const { getAvailableInvites } = await import("@/lib/invites");

    const first = await requestShareInvite({
      itemId: ITEM_ID,
      email: "first@example.com",
    });
    expect(first.status).toBe("invited");

    const invite = await read.invite.findFirstOrThrow({
      where: { email: "first@example.com" },
    });
    // A regular user invite from the sharer, so signup credits them
    expect(invite).toMatchObject({ origin: "user", inviterId: SHARER_ID });
    if (first.status === "invited") {
      expect(first.joinPath).toBe(
        `/join?token=${invite.token}&save=${ITEM_ID}`,
      );
    }
    expect(await getAvailableInvites(SHARER_ID)).toBe(0);

    // Allocation used up: the next reader joins the waitlist, credited
    const second = await requestShareInvite({
      itemId: ITEM_ID,
      email: "second@example.com",
    });
    expect(second).toEqual({ status: "waitlisted" });
    expect(
      await read.waitlistEntry.findUniqueOrThrow({
        where: { email: "second@example.com" },
      }),
    ).toMatchObject({ referralSource: "share:@sharer" });
  });

  it("never over-spends the allocation under concurrent requests", async () => {
    await createSharerWithItem({ inviteAllocation: 1 });
    const { read } = await import("@/lib/db");
    const { requestShareInvite } = await import("@/lib/invites/share-invite");

    const outcomes = await Promise.all(
      ["a", "b", "c", "d"].map((name) =>
        requestShareInvite({ itemId: ITEM_ID, email: `${name}@example.com` }),
      ),
    );

    expect(outcomes.filter((o) => o.status === "invited")).toHaveLength(1);
    expect(outcomes.filter((o) => o.status === "waitlisted")).toHaveLength(3);
    expect(await read.invite.count({ where: { inviterId: SHARER_ID } })).toBe(
      1,
    );
  });

  it("waitlists without spending an invite when the sharer opted out", async () => {
    await createSharerWithItem({ allowShareInvites: false });
    const { read } = await import("@/lib/db");
    const { requestShareInvite } = await import("@/lib/invites/share-invite");

    expect(
      await requestShareInvite({ itemId: ITEM_ID, email: "r@example.com" }),
    ).toEqual({ status: "waitlisted" });
    expect(await read.invite.count()).toBe(0);
  });

  it("sends existing users to log in", async () => {
    await createSharerWithItem();
    const { requestShareInvite } = await import("@/lib/invites/share-invite");

    expect(
      await requestShareInvite({
        itemId: ITEM_ID,
        email: "Sharer@Example.com",
      }),
    ).toEqual({ status: "has_account" });
  });

  it("refuses items that aren't publicly viewable", async () => {
    await createSharerWithItem({ shared: false });
    const { read } = await import("@/lib/db");
    const { requestShareInvite } = await import("@/lib/invites/share-invite");

    expect(
      await requestShareInvite({ itemId: ITEM_ID, email: "r@example.com" }),
    ).toEqual({ status: "unavailable" });
    expect(await read.invite.count()).toBe(0);
    expect(await read.waitlistEntry.count()).toBe(0);
  });
});
