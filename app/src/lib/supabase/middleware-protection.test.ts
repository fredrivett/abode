import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isProtectedPath, PROTECTED_ROUTE_PREFIXES } from "./middleware";

// Every signed-in section lives in the (app) route group, and the middleware is
// what sends a password-only (aal1) session of a 2FA user to its MFA challenge.
// A section missing from PROTECTED_ROUTE_PREFIXES renders for that session.
const APP_GROUP = join(__dirname, "../../app/(app)");

const appSections = readdirSync(APP_GROUP, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => `/${entry.name}`)
  .sort();

describe("PROTECTED_ROUTE_PREFIXES", () => {
  it("covers every top-level section of the (app) route group", () => {
    expect([...PROTECTED_ROUTE_PREFIXES].sort()).toEqual(appSections);
  });
});

describe("isProtectedPath", () => {
  it("matches a section and anything beneath it", () => {
    expect(isProtectedPath("/rooms")).toBe(true);
    expect(isProtectedPath("/rooms/new")).toBe(true);
    expect(isProtectedPath("/settings/tokens")).toBe(true);
  });

  it("doesn't match public pages or look-alike prefixes", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/@someone/rooms")).toBe(false);
    expect(isProtectedPath("/login/verify-mfa")).toBe(false);
    expect(isProtectedPath("/roomsx")).toBe(false);
  });
});
