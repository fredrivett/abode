import { describe, expect, it, vi } from "vitest";
import { metadata as appMetadata } from "@/app/(app)/layout";
import { metadata as authMetadata } from "@/app/(auth)/layout";
import { metadata as authErrorMetadata } from "@/app/auth/error/page";
import { NO_INDEX_ROBOTS } from "./indexing";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/has-completed-signup", () => ({
  hasCompletedSignup: vi.fn(),
}));

// Private surfaces must never land in search results. Guarded at the layout
// level so every page added under these groups inherits it
describe("noindex routes", () => {
  it.each([
    ["(app) — signed-in app pages", appMetadata],
    ["(auth) — login, join, password reset", authMetadata],
    ["/auth/error", authErrorMetadata],
  ])("%s are noindex", (_label, metadata) => {
    expect(metadata.robots).toEqual(NO_INDEX_ROBOTS);
  });
});
