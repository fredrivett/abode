import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasFullAdminAccess: vi.fn(),
  update: vi.fn(),
  getInviteUsage: vi.fn(),
}));

vi.mock("@/lib/admin/auth", () => ({
  hasFullAdminAccess: mocks.hasFullAdminAccess,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({
  default: { user: { update: mocks.update } },
}));
vi.mock("@/lib/invites", () => ({ getInviteUsage: mocks.getInviteUsage }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: vi.fn() } }));

import { setInviteAllocationAsAdmin } from "./actions";

const set = (allocation: number) =>
  setInviteAllocationAsAdmin({ userId: "user-1", allocation });

describe("setInviteAllocationAsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasFullAdminAccess.mockResolvedValue(true);
    mocks.update.mockResolvedValue({});
    mocks.getInviteUsage.mockResolvedValue({
      allocation: 3,
      used: 2,
      available: 1,
    });
  });

  it("sets the allocation and returns the new usage", async () => {
    expect(await set(10)).toEqual({
      success: true,
      usage: { allocation: 10, used: 2, available: 8 },
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { inviteAllocation: 10 },
    });
  });

  it("refuses non-admins (or admins without MFA)", async () => {
    mocks.hasFullAdminAccess.mockResolvedValue(false);
    expect(await set(10)).toEqual({
      error: "Unauthorized: Admin access required",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([-1, 2.5, 1001, Number.NaN])("rejects %s", async (value) => {
    expect(await set(value)).toHaveProperty("error");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("works out the new usage from the new allocation", async () => {
    expect(await set(1)).toEqual({
      success: true,
      usage: { allocation: 1, used: 2, available: 0 },
    });
  });

  it("reports a missing user", async () => {
    mocks.getInviteUsage.mockResolvedValue(null);
    expect(await set(5)).toEqual({ error: "User not found" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the update fails", async () => {
    mocks.update.mockRejectedValue(new Error("db down"));
    expect(await set(5)).toEqual({
      error: "Failed to update invites. Please try again.",
    });
  });
});
