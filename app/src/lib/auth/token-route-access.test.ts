import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import type { TokenScope } from "./token-scopes";

/**
 * Every API route that calls authenticateRequest, and the tokenScope each call
 * passes (null = tokens rejected). Opening a route to tokens is a security
 * decision, so it has to show up here in review — tokens once gained write
 * access by accident when token support was added to the shared auth helper.
 * The list is exhaustive on purpose: a route that dodges the scan (an aliased
 * import, a differently shaped call) changes the scanned set and fails.
 */
const ROUTE_TOKEN_ACCESS: Record<string, (TokenScope | null)[]> = {
  "app/api/mcp/route.ts": ["read"],
  "app/api/v1/imports/[id]/route.ts": [null],
  "app/api/v1/imports/literal/route.ts": [null],
  "app/api/v1/items/[id]/instagram-enrich/route.ts": [null],
  "app/api/v1/items/from-url/route.ts": ["write"],
  "app/api/v1/items/notes/route.ts": ["write"],
};

const SRC_DIR = join(process.cwd(), "src");

// A value import of the helper (type-only imports can't authenticate anything)
const IMPORTS_HELPER =
  /import\s+(?!type\b)[^;]*from\s+["']@\/lib\/auth\/authenticate-request["']/;
const CALL = /\bauthenticateRequest\(/g;
// The route must pass the scope as a literal so this test can read it
const SCOPED_CALL =
  /\bauthenticateRequest\(\s*request\s*,\s*\{\s*tokenScope:\s*(?:"(read|write)"|null)\s*,?\s*\}\s*,?\s*\)/g;

type Caller = { file: string; calls: number; scopes: (TokenScope | null)[] };

function helperCallers(): Caller[] {
  return readdirSync(SRC_DIR, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
    .map((path) => ({
      file: relative(SRC_DIR, join(SRC_DIR, path)).split(sep).join("/"),
      source: readFileSync(join(SRC_DIR, path), "utf8"),
    }))
    .filter(({ source }) => IMPORTS_HELPER.test(source))
    .map(({ file, source }) => ({
      file,
      calls: source.match(CALL)?.length ?? 0,
      scopes: [...source.matchAll(SCOPED_CALL)].map((match) =>
        match[1] === "read" || match[1] === "write" ? match[1] : null,
      ),
    }));
}

describe("personal access token route access", () => {
  const callers = helperCallers();

  it("only API route files call authenticateRequest", () => {
    const nonRoutes = callers
      .map(({ file }) => file)
      .filter((file) => !/^app\/api\/.+\/route\.ts$/.test(file));
    expect(nonRoutes).toEqual([]);
  });

  it.each(callers.map((c) => [c.file, c] as const))(
    "%s calls authenticateRequest directly, with a literal tokenScope each time",
    (_, { calls, scopes }) => {
      // calls === 0 means an aliased import, which the scan can't follow
      expect(calls).toBeGreaterThan(0);
      expect(scopes).toHaveLength(calls);
    },
  );

  it("matches the reviewed route list exactly", () => {
    const actual = Object.fromEntries(
      callers.map(({ file, scopes }) => [file, scopes]),
    );
    expect(actual).toEqual(ROUTE_TOKEN_ACCESS);
  });
});
