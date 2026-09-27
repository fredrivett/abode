import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserWithMfa = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  getUserWithMfa,
}));
vi.mock("@/lib/db", () => ({ default: { user: { update } } }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/milestones", () => ({ markMilestoneComplete: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { PATCH } from "./route";

const patch = (body: unknown) =>
  PATCH({ json: () => Promise.resolve(body) } as NextRequest);

describe("PATCH /api/v1/user/profile — allowSearchIndexing", () => {
  beforeEach(() => {
    getUserWithMfa
      .mockReset()
      .mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    update.mockReset().mockResolvedValue({
      firstName: null,
      lastName: null,
      avatarUrl: null,
      website: null,
      bio: null,
    });
  });

  it("401 when unauthenticated", async () => {
    getUserWithMfa.mockResolvedValue({ data: { user: null }, error: null });
    expect((await patch({ allowSearchIndexing: true })).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "saves allowSearchIndexing=%s for the caller",
    async (enabled) => {
      expect((await patch({ allowSearchIndexing: enabled })).status).toBe(200);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u1" },
          data: { allowSearchIndexing: enabled },
        }),
      );
    },
  );

  it("leaves the setting untouched when not sent", async () => {
    expect((await patch({ bio: "hi" })).status).toBe(200);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { bio: "hi" } }),
    );
  });

  it("400 for a non-boolean value", async () => {
    expect((await patch({ allowSearchIndexing: "yes" })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});
