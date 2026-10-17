import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserWithMfa = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const markMilestoneComplete = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  getUserWithMfa,
}));
vi.mock("@/lib/db", () => ({ default: { user: { update } } }));
vi.mock("@/lib/posthog-server", () => ({
  captureServerException: vi.fn(),
  getPostHogClient: () => null,
}));
vi.mock("@/lib/milestones", () => ({ markMilestoneComplete }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { PATCH } from "./route";

const patch = (body: unknown) =>
  PATCH({ json: () => Promise.resolve(body) } as NextRequest);

const savedUser = (fields: {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}) => ({
  onboardingCompletedAt: new Date(),
  firstName: null,
  lastName: null,
  avatarUrl: null,
  ...fields,
});

describe("PATCH /api/v1/user/onboarding — complete_profile", () => {
  beforeEach(() => {
    getUserWithMfa
      .mockReset()
      .mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    update.mockReset();
    markMilestoneComplete.mockReset();
  });

  it("401 when unauthenticated", async () => {
    getUserWithMfa.mockResolvedValue({ data: { user: null }, error: null });
    expect((await patch({ firstName: "Ada" })).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  // The welcome dialog uploads the avatar first, before there's a name
  it("completes the profile when the name lands after the avatar", async () => {
    update.mockResolvedValue(
      savedUser({ firstName: "Ada", avatarUrl: "u1/avatar.jpg" }),
    );

    expect((await patch({ firstName: "Ada" })).status).toBe(200);

    // The check needs the stored avatar, so the update must select it
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ avatarUrl: true }),
      }),
    );
    expect(markMilestoneComplete).toHaveBeenCalledWith(
      "u1",
      "complete_profile",
    );
  });

  it.each([
    { case: "no avatar", user: savedUser({ firstName: "Ada" }) },
    { case: "no name", user: savedUser({ avatarUrl: "u1/avatar.jpg" }) },
  ])("leaves the profile incomplete with $case", async ({ user }) => {
    update.mockResolvedValue(user);

    expect((await patch({ firstName: user.firstName ?? "" })).status).toBe(200);

    expect(markMilestoneComplete).not.toHaveBeenCalled();
  });
});
