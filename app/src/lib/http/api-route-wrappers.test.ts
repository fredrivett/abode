import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every API route handler is exported through `authedRoute` (signed-in
 * callers, auth checked before the handler runs) or `publicRoute` (anyone,
 * deliberately). A handler exported any other way never authenticates, so a
 * route that forgets auth fails here instead of shipping open.
 *
 * Public routes are listed below, CORS preflights (OPTIONS) aside, so making a
 * route public shows up in review.
 */
const PUBLIC_ROUTES: Record<string, string[]> = {
  "app/api/v1/embed/rooms/[roomId]/route.ts": ["GET"],
  "app/api/v1/invites/validate/route.ts": ["GET"],
  "app/api/v1/share-invites/route.ts": ["POST"],
  "app/api/v1/username/check/route.ts": ["GET"],
  "app/api/v1/waitlist/route.ts": ["POST"],
};

// Route files resolve the caller only through the wrapper's principal: these
// skip the token-scope check, and the first two skip completed signup too
const USER_LOOKUPS =
  /\b(getUserWithMfa|getCompletedSignupUser|getAuthUser|getAuthenticatedUser|authenticateRequest|withViewer)\b/;

const WRAPPERS = new Set(["authedRoute", "publicRoute"]);
const METHOD = "GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS";

const SRC_DIR = join(process.cwd(), "src");

type Route = {
  file: string;
  source: string;
  // Each exported HTTP method and the function it's built with (null = not a call)
  exports: { method: string; wrapper: string | null }[];
  // Exports this scan can't follow (re-exports, function declarations)
  unreadable: string[];
};

function routeFiles(): Route[] {
  return readdirSync(join(SRC_DIR, "app/api"), {
    recursive: true,
    encoding: "utf8",
  })
    .filter((path) => path.split(sep).at(-1) === "route.ts")
    .map((path) => {
      const absolute = join(SRC_DIR, "app/api", path);
      const source = readFileSync(absolute, "utf8");
      return {
        file: relative(SRC_DIR, absolute).split(sep).join("/"),
        source,
        ...readExports(source),
      };
    });
}

function readExports(source: string): Omit<Route, "file" | "source"> {
  const exports: Route["exports"] = [];
  const unreadable: string[] = [];
  // What a local name is initialised with: `const x = wrapper(` → wrapper
  const builtWith = (name: string) =>
    new RegExp(`\\bconst ${name}\\s*=\\s*(\\w+)\\s*[(<]`).exec(source)?.[1] ??
    null;

  for (const [, method, init] of source.matchAll(
    new RegExp(`export const (${METHOD})\\s*=\\s*(\\w+)`, "g"),
  )) {
    const called = new RegExp(
      `export const ${method}\\s*=\\s*${init}\\s*[(<]`,
    ).test(source);
    exports.push({ method, wrapper: called ? init : builtWith(init) });
  }
  for (const [, list] of source.matchAll(/export\s*\{([^}]*)\}(?!\s*from)/g)) {
    for (const [, local, method] of list.matchAll(
      new RegExp(`(\\w+)\\s+as\\s+(${METHOD})\\b`, "g"),
    )) {
      exports.push({ method, wrapper: builtWith(local) });
    }
  }
  for (const [statement] of source.matchAll(
    new RegExp(
      `export\\s+(?:async\\s+)?function\\s+(?:${METHOD})\\b|export\\s*(?:\\{[^}]*\\}|\\*)\\s*from`,
      "g",
    ),
  )) {
    unreadable.push(statement);
  }
  return { exports, unreadable };
}

describe("API route wrappers", () => {
  const routes = routeFiles();

  it("finds the route files", () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it.each(routes.map((route) => [route.file, route] as const))(
    "%s exports every handler through authedRoute or publicRoute",
    (_, { exports, unreadable }) => {
      expect(
        unreadable,
        "Export the handler as `export const GET = …`",
      ).toEqual([]);
      expect(exports.length).toBeGreaterThan(0);
      const unwrapped = exports.filter(
        ({ wrapper }) => !wrapper || !WRAPPERS.has(wrapper),
      );
      expect(
        unwrapped,
        'Wrap it: authedRoute({ credentials: "session" }, handler), or publicRoute(handler) for a deliberately public route',
      ).toEqual([]);
    },
  );

  it.each(routes.map((route) => [route.file, route] as const))(
    "%s resolves its caller only through authedRoute",
    (_, { source }) => {
      expect(source.match(USER_LOOKUPS)?.[0] ?? null).toBeNull();
    },
  );

  it("matches the reviewed list of public routes", () => {
    const actual = Object.fromEntries(
      routes
        .map(({ file, exports }) => [
          file,
          exports
            .filter(
              ({ method, wrapper }) =>
                wrapper === "publicRoute" && method !== "OPTIONS",
            )
            .map(({ method }) => method),
        ])
        .filter(([, methods]) => methods.length > 0),
    );
    expect(actual).toEqual(PUBLIC_ROUTES);
  });
});
