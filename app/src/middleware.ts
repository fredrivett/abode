import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Next.js middleware entry point — delegates to Supabase session management. */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - vendor/ (self-hosted third-party runtime assets, e.g. the scanner's)
     * - public assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|vendor/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
