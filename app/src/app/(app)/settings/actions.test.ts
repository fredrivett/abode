import { beforeEach, describe, expect, it, vi } from "vitest";

// These account-management actions are never wrapped by (app)/layout.tsx, so
// each must turn away an incomplete-signup account itself — otherwise an
// email-confirmed, uninvited account could call changeUsername directly, gain a
// username and so complete signup without an invite. They resolve their user
// through getCompletedSignupUser; this test fails if one stops doing so.
const { mockGetCompletedSignupUser } = vi.hoisted(() => ({
  mockGetCompletedSignupUser: vi.fn(),
}));

vi.mock("@/lib/auth/completed-signup-user", () => ({
  getCompletedSignupUser: mockGetCompletedSignupUser,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
}));
// The actions import these at module load; the real work is never reached when
// the gate rejects, so bare stubs are enough.
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: {} }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email/templates", () => ({
  getUserAccountDeletionEmail: vi.fn(),
}));
vi.mock("@/lib/posthog-server", () => ({
  captureServerException: vi.fn(),
  getPostHogClient: vi.fn(),
}));
vi.mock("@/lib/storage-objects", () => ({ removeUserStorage: vi.fn() }));

import {
  changeUsername,
  deleteAccount,
  requestEmailChange,
} from "@/app/(app)/settings/actions";

beforeEach(() => {
  vi.clearAllMocks();
});

// Each action resolved with a form that would otherwise succeed, so an
// unchecked action couldn't return Unauthorized for an unrelated reason.
const cases = [
  [
    "changeUsername",
    () => changeUsername({}, formData({ username: "taken_name" })),
  ],
  ["deleteAccount", () => deleteAccount({}, formData({ password: "pw" }))],
  [
    "requestEmailChange",
    () => requestEmailChange({}, formData({ email: "new@example.com" })),
  ],
] as const;

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("settings actions reject an account that hasn't completed signup", () => {
  it.each(cases)(
    "%s returns Unauthorized when getCompletedSignupUser returns null",
    async (_name, run) => {
      mockGetCompletedSignupUser.mockResolvedValue(null);

      await expect(run()).resolves.toEqual({ error: "Unauthorized" });
      expect(mockGetCompletedSignupUser).toHaveBeenCalledTimes(1);
    },
  );
});
