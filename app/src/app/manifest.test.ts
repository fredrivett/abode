import { describe, expect, it } from "vitest";
import { isProtectedPath } from "@/lib/supabase/middleware";
import manifest from "./manifest";

describe("manifest", () => {
  const m = manifest();

  it("keeps the install identity stable", () => {
    // Changing id makes browsers treat existing installs as a different app
    expect(m.id).toBe("/");
  });

  it("launches straight into the app, not the redirecting homepage", () => {
    expect(m.start_url).not.toBe("/");
    expect(isProtectedPath(m.start_url ?? "")).toBe(true);
  });
});
