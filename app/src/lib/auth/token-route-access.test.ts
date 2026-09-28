import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { isTokenScope, type TokenScope } from "./token-scopes";

/**
 * Every API route a personal access token can reach, and the scope it needs.
 * Opening a route to tokens is a security decision, so it has to show up here
 * in review — tokens once gained write access by accident when token support
 * was added to the shared auth helper. Routes absent from this list must pass
 * `tokenScope: null` (or not use authenticateRequest at all).
 */
const TOKEN_ROUTES: Record<string, TokenScope[]> = {
  "v1/items/from-url": ["write"],
  "v1/items/notes": ["write"],
};

const API_DIR = join(process.cwd(), "src", "app", "api");

const CALL = /\bauthenticateRequest\(/g;
// The route must pass the scope as a literal so this test can read it
const SCOPED_CALL =
  /\bauthenticateRequest\(\s*request\s*,\s*\{\s*tokenScope:\s*(?:"(read|write)"|null)\s*,?\s*\}\s*,?\s*\)/g;

type RouteAccess = {
  route: string;
  calls: number;
  literalCalls: number;
  scopes: TokenScope[];
};

function routeAccess(): RouteAccess[] {
  return readdirSync(API_DIR, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(`${sep}route.ts`))
    .map((path) => {
      const source = readFileSync(join(API_DIR, path), "utf8");
      const scoped = [...source.matchAll(SCOPED_CALL)];
      return {
        route: dirname(path).split(sep).join("/"),
        calls: source.match(CALL)?.length ?? 0,
        literalCalls: scoped.length,
        scopes: scoped.map((match) => match[1]).filter(isTokenScope),
      };
    })
    .filter(({ calls }) => calls > 0);
}

describe("personal access token route access", () => {
  const routes = routeAccess();

  it("finds the routes that use authenticateRequest", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes.map((r) => [r.route, r] as const))(
    "%s passes a literal tokenScope to every authenticateRequest call",
    (_, { calls, literalCalls }) => {
      expect(literalCalls).toBe(calls);
    },
  );

  it("only the allowlisted routes accept tokens, with the listed scopes", () => {
    const actual = Object.fromEntries(
      routes
        .filter(({ scopes }) => scopes.length > 0)
        .map(({ route, scopes }) => [route, [...new Set(scopes)].sort()]),
    );
    expect(actual).toEqual(TOKEN_ROUTES);
  });
});
