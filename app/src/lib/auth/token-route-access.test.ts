import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import type { TokenScope } from "./token-scopes";

/**
 * Every API route that accepts a bearer credential, and what each authedRoute
 * call in it declares: a tokenScope (null = personal access tokens rejected,
 * Supabase bearer tokens still accepted) or "session" (cookie only). Opening a
 * route to tokens is a security decision, so it has to show up here in review —
 * tokens once gained write access by accident when token support was added to
 * the shared auth helper. Routes whose every call is `credentials: "session"`
 * are left out; switching one to a tokenScope makes it appear and fails. The
 * list is exhaustive on purpose: a route that dodges the scan (an aliased
 * import, a differently shaped call) changes the scanned set and fails.
 */
type Access = TokenScope | null | "session";
const ROUTE_TOKEN_ACCESS: Record<string, Access[]> = {
  "app/api/mcp/route.ts": ["read"],
  "app/api/v1/imports/[id]/route.ts": [null],
  "app/api/v1/imports/literal/route.ts": [null],
  "app/api/v1/items/[id]/instagram-enrich/route.ts": [null],
  "app/api/v1/items/from-url/route.ts": ["write"],
  "app/api/v1/items/notes/route.ts": ["write"],
};

const SRC_DIR = join(process.cwd(), "src");

// A value import of the helper (type-only imports can't authenticate anything)
const IMPORTS_AUTHENTICATE =
  /import\s+(?!type\b)[^;]*from\s+["']@\/lib\/auth\/authenticate-request["']/;
const IMPORTS_HELPER =
  /import\s+(?!type\b)[^;]*from\s+["']@\/lib\/http\/authed-route["']/;
const CALL = /\bauthedRoute(?:<[^>]*>)?\(/g;
// The route must declare its credentials as a literal, first, so this test can read them
const SCOPED_CALL =
  /\bauthedRoute(?:<[^>]*>)?\(\s*\{\s*(?:tokenScope:\s*(?:"(read|write)"|null)|credentials:\s*"(session)")\s*[,}]/g;

type Caller = { file: string; calls: number; scopes: Access[] };

function sourceFiles() {
  return readdirSync(SRC_DIR, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
    .map((path) => ({
      file: relative(SRC_DIR, join(SRC_DIR, path)).split(sep).join("/"),
      source: readFileSync(join(SRC_DIR, path), "utf8"),
    }));
}

function helperCallers(): Caller[] {
  return sourceFiles()
    .filter(({ source }) => IMPORTS_HELPER.test(source))
    .map(({ file, source }) => ({
      file,
      calls: source.match(CALL)?.length ?? 0,
      scopes: [...source.matchAll(SCOPED_CALL)].map((match): Access => {
        if (match[2] === "session") return "session";
        return match[1] === "read" || match[1] === "write" ? match[1] : null;
      }),
    }));
}

describe("personal access token route access", () => {
  const callers = helperCallers();

  it("only authedRoute calls authenticateRequest", () => {
    const direct = sourceFiles()
      .filter(({ source }) => IMPORTS_AUTHENTICATE.test(source))
      .map(({ file }) => file);
    expect(direct).toEqual(["lib/http/authed-route.ts"]);
  });

  it("only API route files call authedRoute", () => {
    const nonRoutes = callers
      .map(({ file }) => file)
      .filter((file) => !/^app\/api\/.+\/route\.ts$/.test(file));
    expect(nonRoutes).toEqual([]);
  });

  it.each(callers.map((c) => [c.file, c] as const))(
    "%s calls authedRoute directly, declaring its credentials as a literal each time",
    (_, { calls, scopes }) => {
      // calls === 0 means an aliased import, which the scan can't follow
      expect(calls).toBeGreaterThan(0);
      expect(scopes).toHaveLength(calls);
    },
  );

  it("matches the reviewed route list exactly", () => {
    const actual = Object.fromEntries(
      callers
        .filter(({ scopes }) => scopes.some((scope) => scope !== "session"))
        .map(({ file, scopes }) => [file, scopes]),
    );
    expect(actual).toEqual(ROUTE_TOKEN_ACCESS);
  });
});
