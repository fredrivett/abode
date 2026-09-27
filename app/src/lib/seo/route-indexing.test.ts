import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type { Metadata } from "next";
import { describe, expect, it, vi } from "vitest";
import { metadata as appMetadata } from "@/app/(app)/layout";
import { metadata as authMetadata } from "@/app/(auth)/layout";
import { metadata as publicMetadata } from "@/app/(public)/layout";
import { metadata as authErrorMetadata } from "@/app/auth/error/page";
import { NO_INDEX_ROBOTS, SITEMAP_PATHS } from "./indexing";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/has-completed-signup", () => ({
  hasCompletedSignup: vi.fn(),
}));

const APP_DIR = join(process.cwd(), "src", "app");

// Pages that are neither noindex nor in the sitemap, on purpose
const EXCEPTIONS: Record<string, string> = {
  "/~offline": "service-worker offline fallback, never served to crawlers",
};

type Page = { file: string; route: string };

function findPages(dir: string): Page[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(`${sep}page.tsx`) || path === "page.tsx")
    .map((path) => {
      const segments = dirname(path)
        .split(sep)
        .filter((segment) => segment !== "." && !/^\(.+\)$/.test(segment));
      return { file: join(dir, path), route: `/${segments.join("/")}` };
    });
}

// Matches the metadata assignment, not a mention in a comment or string
const SETS_NO_INDEX = /\brobots:\s*NO_INDEX_ROBOTS\b/;

// The page itself or any layout above it (up to src/app) sets NO_INDEX_ROBOTS
function isNoIndex(pageFile: string): boolean {
  if (SETS_NO_INDEX.test(readFileSync(pageFile, "utf8"))) return true;

  let dir = dirname(pageFile);
  while (relative(APP_DIR, dir) !== "..") {
    const layout = join(dir, "layout.tsx");
    if (
      existsSync(layout) &&
      SETS_NO_INDEX.test(readFileSync(layout, "utf8"))
    ) {
      return true;
    }
    if (dir === APP_DIR) break;
    dir = dirname(dir);
  }
  return false;
}

const pages = findPages(APP_DIR);
const sitemapPaths: readonly string[] = SITEMAP_PATHS;

describe("route indexing", () => {
  it("finds the app's pages", () => {
    expect(pages.map((page) => page.route)).toContain("/");
  });

  // A new page must be a deliberate choice: in search (sitemap), out of search
  // (noindex via NO_INDEX_ROBOTS), or an explicit exception with a reason
  it("classifies every page as sitemap, noindex or an explicit exception", () => {
    const unclassified = pages
      .filter(
        ({ file, route }) =>
          !sitemapPaths.includes(route) &&
          !isNoIndex(file) &&
          !(route in EXCEPTIONS),
      )
      .map(({ file }) => relative(process.cwd(), file));

    expect(
      unclassified,
      "Add public pages to SITEMAP_PATHS (@/lib/seo/indexing), set `robots: NO_INDEX_ROBOTS` for private ones, or add an EXCEPTIONS entry with a reason",
    ).toEqual([]);
  });

  it("only lists existing, indexable pages in the sitemap", () => {
    for (const path of sitemapPaths) {
      const page = pages.find(({ route }) => route === path);
      expect(page, `${path} has no page.tsx`).toBeDefined();
      if (page) expect(isNoIndex(page.file), `${path} is noindex`).toBe(false);
    }
  });

  it("has no stale exceptions", () => {
    const routes = pages.map(({ route }) => route);
    expect(
      Object.keys(EXCEPTIONS).filter((route) => !routes.includes(route)),
    ).toEqual([]);
  });

  it.each([...sitemapPaths])(
    "%s has its own title, description and canonical URL",
    async (path) => {
      const page = pages.find(({ route }) => route === path);
      if (!page) throw new Error(`${path} has no page.tsx`);
      const { metadata }: { metadata?: Metadata } = await import(page.file);

      expect(metadata?.title).toBeTruthy();
      expect(metadata?.description).toBeTruthy();
      expect(metadata?.alternates?.canonical).toBe(path);
    },
  );
});

// Private surfaces must never land in search results. Guarded at the layout
// level so every page added under these groups inherits it
describe("noindex routes", () => {
  it.each([
    ["(app) — signed-in app pages", appMetadata],
    ["(auth) — login, join, password reset", authMetadata],
    ["(public) — shared profiles, rooms and items", publicMetadata],
    ["/auth/error", authErrorMetadata],
  ])("%s are noindex", (_label, metadata) => {
    expect(metadata.robots).toEqual(NO_INDEX_ROBOTS);
  });
});
