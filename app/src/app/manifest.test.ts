import { describe, expect, it } from "vitest";
import { LAUNCH_PAGE } from "@/lib/pwa/launch";
import { isProtectedPath } from "@/lib/supabase/middleware";
import manifest from "./manifest";

describe("manifest", () => {
  const m = manifest();

  it("keeps the install identity stable", () => {
    // Changing id makes browsers treat existing installs as a different app
    expect(m.id).toBe("/");
  });

  it("launches on the precached skeleton, not the redirecting homepage", () => {
    expect(m.start_url).toBe(LAUNCH_PAGE);
    // Signed out, the skeleton still loads (and then hands on to login)
    expect(isProtectedPath(LAUNCH_PAGE)).toBe(false);
  });
});
