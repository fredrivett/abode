import { createMcpHandler } from "@modelcontextprotocol/server";
import { type NextRequest, NextResponse } from "next/server";
import type { Principal } from "@/lib/auth/authenticate-request";
import { authedRoute } from "@/lib/http/authed-route";
import { createLogger } from "@/lib/logger.server";
import {
  buildMcpServer,
  callerFromAuthInfo,
  toAuthInfo,
} from "@/lib/mcp/server";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("api/mcp");

/**
 * abode's MCP server (Streamable HTTP, stateless): read-only tools over the
 * caller's library. Clients authenticate with a personal access token holding
 * the `read` scope (`Authorization: Bearer abode_pat_…`); a signed-in web
 * session works too. Serves the current MCP revision and 2025-era clients.
 */
const handler = createMcpHandler(({ authInfo }) => {
  const caller = callerFromAuthInfo(authInfo);
  // Unreachable: every request is authenticated before it reaches the handler
  if (!caller)
    throw new Error("MCP request reached the server without a caller");
  return buildMcpServer(caller);
});

async function handle(
  request: NextRequest,
  { principal }: { principal: Principal },
): Promise<Response> {
  try {
    return await handler.fetch(request, { authInfo: toAuthInfo(principal) });
  } catch (error) {
    // Tool failures are handled per tool (lib/mcp/server); this catches the
    // auth lookup or the transport itself failing
    log.error({ error }, "MCP request failed");
    captureServerException(error, undefined, {
      route: `${request.method} /api/mcp`,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

const framedHandle = authedRoute({ tokenScope: "read" }, handle);

export { framedHandle as DELETE, framedHandle as GET, framedHandle as POST };
