import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isProtectedPath } from "./middleware";

// Every signed-in page lives in the (app) route group, and the middleware is
// what sends a password-only (aal1) session of a 2FA user to its MFA challenge.
// A page PROTECTED_ROUTE_PREFIXES misses renders for that session; a prefix
// that's too broad locks a public page (or the local-only (dev) tools) behind
// login.
const APP_DIR = join(__dirname, "../../app");

type Page = { path: string; inAppGroup: boolean };

/** URL path of every page.tsx under `dir`, flattening route groups. */
function collectPages(dir: string, segments: string[], inAppGroup: boolean) {
  const pages: Page[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === "page.tsx") {
      pages.push({ path: `/${segments.join("/")}`, inAppGroup });
    }
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
    const isSlot = entry.name.startsWith("@");
    pages.push(
      ...collectPages(
        join(dir, entry.name),
        isGroup || isSlot ? segments : [...segments, entry.name],
        inAppGroup || entry.name === "(app)",
      ),
    );
  }
  return pages;
}

const pages = collectPages(APP_DIR, [], false);

describe("PROTECTED_ROUTE_PREFIXES", () => {
  it("finds the app's pages", () => {
    expect(pages.filter((page) => page.inAppGroup).length).toBeGreaterThan(5);
  });

  it("protects every page in the (app) route group", () => {
    const unprotected = pages
      .filter((page) => page.inAppGroup && !isProtectedPath(page.path))
      .map((page) => page.path);
    expect(unprotected).toEqual([]);
  });

  it("protects no page outside the (app) route group", () => {
    const overProtected = pages
      .filter((page) => !page.inAppGroup && isProtectedPath(page.path))
      .map((page) => page.path);
    expect(overProtected).toEqual([]);
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
