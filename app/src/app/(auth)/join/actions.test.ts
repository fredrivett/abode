import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  signUp: vi.fn(),
  validateInviteToken: vi.fn(),
  findFirst: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp: m.signUp } }),
}));
vi.mock("@/lib/invites", () => ({
  validateInviteToken: m.validateInviteToken,
}));
vi.mock("@/lib/db", () => ({ default: { user: { findFirst: m.findFirst } } }));
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ capture: m.capture }),
}));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/lib/url", () => ({ getAppBaseUrl: () => "https://abode.test" }));

import { signupWithInvite } from "./actions";

const SAVE_ITEM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const NEW_USER_ID = "new-user-id";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const signupForm = (extra: Record<string, string> = {}) =>
  form({
    token: "invite-token",
    password: "a-long-password",
    username: "newperson",
    ...extra,
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.validateInviteToken.mockResolvedValue({
    valid: true,
    invite: {
      email: "new@example.test",
      origin: "user",
      inviterId: "inviter-id",
    },
  });
  m.findFirst.mockResolvedValue(null);
  m.signUp.mockResolvedValue({
    data: { user: { id: NEW_USER_ID, identities: [{ id: "identity" }] } },
    error: null,
  });
});

describe("signupWithInvite analytics", () => {
  it("captures signup_started for the new user, without email or username", async () => {
    const result = await signupWithInvite({}, signupForm());

    expect(result.success).toBe(true);
    expect(m.capture).toHaveBeenCalledTimes(1);
    expect(m.capture).toHaveBeenCalledWith({
      distinctId: NEW_USER_ID,
      event: "signup_started",
      properties: { invite_origin: "user", has_save_item: false },
    });
    const sent = JSON.stringify(m.capture.mock.calls);
    expect(sent).not.toContain("new@example.test");
    expect(sent).not.toContain("newperson");
    expect(sent).not.toContain("invite-token");
  });

  it("records whether a shared item will be saved", async () => {
    await signupWithInvite({}, signupForm({ save: SAVE_ITEM_ID }));

    expect(m.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: { invite_origin: "user", has_save_item: true },
      }),
    );
  });

  it("doesn't capture when signup fails", async () => {
    m.signUp.mockResolvedValue({
      data: { user: null },
      error: { message: "Signups not allowed" },
    });

    const result = await signupWithInvite({}, signupForm());

    expect(result.error).toBe("Signups not allowed");
    expect(m.capture).not.toHaveBeenCalled();
  });

  it("doesn't capture for an already-registered email's placeholder user", async () => {
    m.signUp.mockResolvedValue({
      data: { user: { id: "placeholder", identities: [] } },
      error: null,
    });

    await signupWithInvite({}, signupForm());

    expect(m.capture).not.toHaveBeenCalled();
  });

  it("doesn't capture when the invite or username is rejected", async () => {
    m.validateInviteToken.mockResolvedValue({
      valid: false,
      error: "Invalid invite token",
    });
    await signupWithInvite({}, signupForm());

    m.validateInviteToken.mockResolvedValue({
      valid: true,
      invite: { email: "new@example.test", origin: "user", inviterId: "x" },
    });
    m.findFirst.mockResolvedValue({ id: "someone-else" });
    await signupWithInvite({}, signupForm());

    expect(m.signUp).not.toHaveBeenCalled();
    expect(m.capture).not.toHaveBeenCalled();
  });
});
