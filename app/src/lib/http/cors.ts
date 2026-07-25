import { type NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/url";

/**
 * CORS for first-party non-web clients (the browser extension today; the mobile
 * app later). These authenticate with `Authorization: Bearer` — never cookies —
 * so we deliberately never send `Access-Control-Allow-Credentials`. That keeps
 * the surface free of ambient-credential / CSRF concerns: reflecting an origin
 * here grants no access on its own, since every request still needs a token.
 */
export function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  // Browser extensions (Chrome/Edge/Firefox) — bearer-authed, safe to reflect.
  if (origin.startsWith("chrome-extension://")) return true;
  if (origin.startsWith("moz-extension://")) return true;
  // The app's own origin, for first-party fetches from another surface.
  try {
    return origin === new URL(getAppBaseUrl()).origin;
  } catch {
    return false;
  }
}

/** Attaches CORS headers to a response (used on the actual POST responses). */
export function withCors(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    response.headers.set(key, value);
  }
  return response;
}

/** Standard CORS preflight response for an `OPTIONS` handler. */
export function preflight(request: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}
