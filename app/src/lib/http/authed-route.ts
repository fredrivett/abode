import { type NextRequest, NextResponse } from "next/server";
import {
  type AuthenticateRequestOptions,
  authenticateRequest,
  type Principal,
} from "@/lib/auth/authenticate-request";
import { withCors } from "@/lib/http/cors";
import { withViewer } from "@/lib/http/with-viewer";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("lib/http/authed-route");

type AuthedRouteOptions = AuthenticateRequestOptions & {
  /** Add CORS headers to every response, the 401 included (extension routes) */
  cors?: boolean;
};

/**
 * Wrap an API route handler that needs a signed-in caller:
 *
 *   export const POST = authedRoute({ tokenScope: "write" }, async (request, { principal }) => …);
 *
 * The request runs in its own viewer frame (see `withViewer`), is
 * authenticated by `authenticateRequest` with the declared `tokenScope`, and
 * gets a 401 before the handler runs when that fails. The handler receives the
 * route context (`params`), if any, plus the `principal`.
 *
 * `tokenScope` must be a literal: `token-route-access.test.ts` reads it from
 * the source to pin which routes personal access tokens can reach.
 */
export function authedRoute<Context extends { principal: Principal }>(
  { cors = false, ...authOptions }: AuthedRouteOptions,
  handler: (request: NextRequest, context: Context) => Promise<Response>,
): RouteHandler<Context> {
  async function respond(
    request: NextRequest,
    ctx: RouteContext<Context> | undefined,
  ): Promise<Response> {
    let principal: Principal | null;
    try {
      principal = await authenticateRequest(request, authOptions);
    } catch (error) {
      log.error({ error }, "Authenticating request failed");
      captureServerException(error, undefined, {
        route: `${request.method} ${new URL(request.url).pathname}`,
      });
      return NextResponse.json(
        { message: "Internal server error" },
        { status: 500 },
      );
    }
    if (!principal) {
      return NextResponse.json(
        { message: "Unauthorized" },
        // Plain bearer challenge: abode has no OAuth server to point clients at
        {
          status: 401,
          headers: { "WWW-Authenticate": 'Bearer realm="abode"' },
        },
      );
    }
    // Context is exactly RouteContext<Context> plus the principal
    return handler(request, { ...ctx, principal } as Context);
  }

  // Accepts every context shape; the return type narrows it per route
  return withViewer(
    async (request: NextRequest, ctx?: RouteContext<Context>) => {
      const response = await respond(request, ctx);
      return cors ? withCors(request, response) : response;
    },
  );
}

/** What Next passes a route handler (`params`), without the principal we add */
type RouteContext<Context> = Omit<Context, "principal">;

// Optional for routes without params, so callers (and tests) can pass just the request
type RouteContextArg<Context> = keyof RouteContext<Context> extends never
  ? [ctx?: RouteContext<Context>]
  : [ctx: RouteContext<Context>];

type RouteHandler<Context> = (
  request: NextRequest,
  ...ctx: RouteContextArg<Context>
) => Promise<Response>;
