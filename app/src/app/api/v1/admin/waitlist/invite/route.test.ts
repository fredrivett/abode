import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockFullAdmin, mockCreateInvite } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFullAdmin: vi.fn(),
  mockCreateInvite: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: mockGetUser,
}));
vi.mock("@/lib/admin/auth", () => ({ hasFullAdminAccess: mockFullAdmin }));
vi.mock("@/lib/invites", () => ({ createWaitlistInvite: mockCreateInvite }));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ success: true, id: "email" })),
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));

import { POST } from "./route";

const invite = () =>
  POST(
    new NextRequest("http://localhost/api/v1/admin/waitlist/invite", {
      method: "POST",
      body: JSON.stringify({
        waitlistEntryId: "0f8fad5b-d9cb-469f-a165-70867728950e",
      }),
    }),
  );

describe("POST /api/v1/admin/waitlist/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin" } } });
  });

  it("refuses an admin who hasn't completed 2FA, without inviting", async () => {
    mockFullAdmin.mockResolvedValue(false);

    const res = await invite();

    expect(res.status).toBe(403);
    expect(mockCreateInvite).not.toHaveBeenCalled();
  });

  it("lets a full admin (AAL2) invite", async () => {
    mockFullAdmin.mockResolvedValue(true);
    mockCreateInvite.mockResolvedValue({
      success: true,
      invite: { id: "invite", email: "waiting@example.com", token: "token" },
    });

    const res = await invite();

    expect(res.status).toBe(200);
    expect(mockCreateInvite).toHaveBeenCalledWith(
      "0f8fad5b-d9cb-469f-a165-70867728950e",
    );
  });

  it("refuses a signed-out caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    expect((await invite()).status).toBe(401);
    expect(mockCreateInvite).not.toHaveBeenCalled();
  });
});
