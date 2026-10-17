import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signInWithPassword: m.signInWithPassword },
  }),
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/auth/has-completed-signup", () => ({
  hasCompletedSignup: async () => true,
}));
vi.mock("@/lib/mfa", () => ({
  getAAL: async () => ({}),
  isMfaChallengePending: () => false,
}));
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ capture: m.capture, identify: m.identify }),
}));

import { login } from "./actions";

const USER_ID = "user-1";
const EMAIL = "someone@example.test";

function loginForm(): FormData {
  const data = new FormData();
  data.set("email", EMAIL);
  data.set("password", "a-long-password");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.signInWithPassword.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  });
});

describe("login analytics", () => {
  it("captures user_logged_in without the email as an event property", async () => {
    await expect(login({}, loginForm())).rejects.toThrow("redirect:");

    expect(m.capture).toHaveBeenCalledWith({
      distinctId: USER_ID,
      event: "user_logged_in",
      properties: { source: "password" },
    });
    expect(JSON.stringify(m.capture.mock.calls)).not.toContain(EMAIL);
  });

  it("keeps the email on the person via identify", async () => {
    await expect(login({}, loginForm())).rejects.toThrow("redirect:");

    expect(m.identify).toHaveBeenCalledWith({
      distinctId: USER_ID,
      properties: { email: EMAIL },
    });
  });
});
