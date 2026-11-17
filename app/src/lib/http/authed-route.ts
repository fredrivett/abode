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
  /**
   * Run the handler for signed-out visitors too, with a null principal,
   * instead of answering 401 (routes that serve public content)
   */
  allowAnonymous?: boolean;
};

type Handler<Context> = (
  request: NextRequest,
  context: Context,
) => Promise<Response>;

/**
 * Wrap an API route handler that needs a signed-in caller:
 *
 *   export const POST = authedRoute({ tokenScope: "write" }, async (request, { principal }) => …);
 *   export const GET = authedRoute({ credentials: "session" }, handleGET);
 *
 * The request runs in its own viewer frame (see `withViewer`), is
 * authenticated by `authenticateRequest` with the declared credentials, and
 * gets a 401 before the handler runs when that fails (or a 500 when the lookup
 * itself throws). The handler receives the route context (`params`), if any,
 * plus the `principal`. With `allowAnonymous` a signed-out request reaches the
 * handler with a null principal instead.
 *
 * `tokenScope` / `credentials` must be literals: `token-route-access.test.ts`
 * reads them from the source to pin which routes tokens can reach.
 */
export function authedRoute<Context extends { principal: Principal }>(
  options: AuthedRouteOptions & { allowAnonymous?: false },
  handler: Handler<Context>,
): RouteHandler<Context>;
export function authedRoute<Context extends { principal: Principal | null }>(
  options: AuthedRouteOptions & { allowAnonymous: true },
  handler: Handler<Context>,
): RouteHandler<Context>;
export function authedRoute<Context extends { principal: Principal | null }>(
  { cors = false, allowAnonymous = false, ...authOptions }: AuthedRouteOptions,
  handler: Handler<Context>,
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
        route: `${request.method} ${routePath(request)}`,
      });
      return NextResponse.json(
        { message: "Internal server error" },
        { status: 500 },
      );
    }
    if (!principal && !allowAnonymous) {
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

/**
 * Wrap an API route handler that serves anyone, signed in or not, without
 * authenticating: CORS preflights and deliberately public endpoints (waitlist,
 * embeds, username checks). The request still runs in its own anonymous
 * viewer frame, so `db` sees no user-owned rows. Every route using it is listed
 * in `api-route-wrappers.test.ts`, so making a route public shows up in review.
 */
export function publicRoute<Args extends unknown[], Result>(
  handler: (...args: Args) => Result,
): (...args: Args) => Result {
  return withViewer(handler);
}

/** What Next passes a route handler (`params`), without the principal we add */
type RouteContext<Context> = Omit<Context, "principal">;

// Routes without params take just the request, as Next's generated route
// types expect; routes with params take their context, required
type RouteHandler<Context> = keyof RouteContext<Context> extends never
  ? (request: NextRequest) => Promise<Response>
  : (request: NextRequest, ctx: RouteContext<Context>) => Promise<Response>;

// For error labels only: must not throw, or the 500 path itself fails
function routePath(request: NextRequest): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "(unknown path)";
  }
}
