import { createMcpHandler } from "@modelcontextprotocol/server";
import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticate-request";
import {
  buildMcpServer,
  callerFromAuthInfo,
  toAuthInfo,
} from "@/lib/mcp/server";

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

async function handle(request: NextRequest): Promise<Response> {
  const auth = await authenticateRequest(request, { tokenScope: "read" });
  if (!auth) {
    return NextResponse.json(
      { message: "Unauthorized" },
      // Plain bearer challenge: abode has no OAuth server to point clients at
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="abode"' } },
    );
  }
  return handler.fetch(request, { authInfo: toAuthInfo(auth) });
}

export { handle as DELETE, handle as GET, handle as POST };
