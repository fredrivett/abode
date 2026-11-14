import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminAccessResult } from "./auth";

const m = vi.hoisted(() => ({ checkAdminAccess: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("./auth", () => ({ checkAdminAccess: m.checkAdminAccess }));

import { requireAdmin } from "./require-admin";

const FULL_ACCESS: AdminAccessResult = {
  userId: "user-1",
  isAdmin: true,
  hasMFA: true,
  isAAL2: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAdmin", () => {
  it("resolves for an admin with MFA at aal2", async () => {
    m.checkAdminAccess.mockResolvedValue(FULL_ACCESS);
    await expect(requireAdmin()).resolves.toBeUndefined();
  });

  it.each<[string, Partial<AdminAccessResult>, string]>([
    ["a signed-out visitor", { userId: null, isAdmin: false }, "/login"],
    ["a signed-in non-admin", { isAdmin: false }, "/dashboard"],
    ["an admin without MFA", { hasMFA: false }, "/settings?setup=mfa"],
    ["an admin still at aal1", { isAAL2: false }, "/admin/verify"],
  ])("redirects %s", async (_, access, destination) => {
    m.checkAdminAccess.mockResolvedValue({ ...FULL_ACCESS, ...access });
    await expect(requireAdmin()).rejects.toThrow(`redirect:${destination}`);
  });
});
