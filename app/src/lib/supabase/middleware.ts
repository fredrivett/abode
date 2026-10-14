import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isMfaChallengePending } from "@/lib/mfa";
import { getSafeRedirectPath } from "@/lib/url-utils";

/**
 * Top-level sections of the signed-in app (the `(app)` route group). Every one
 * needs a session and, for users with 2FA, a completed MFA challenge —
 * middleware-protection.test.ts fails when a new section isn't listed.
 */
export const PROTECTED_ROUTE_PREFIXES = [
  "/admin",
  "/dashboard",
  "/dev",
  "/help",
  "/rooms",
  "/save",
  "/settings",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Refreshes the Supabase auth session and enforces route protection.
 *
 * Redirects unauthenticated users away from protected routes, enforces MFA
 * challenges, and redirects authenticated users away from auth/landing pages.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({
            request,
          });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not run code between createServerClient and supabase.auth.getUser().
  // A simple mistake could make it very hard to debug issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes - redirect to login if not authenticated
  const isProtectedRoute = isProtectedPath(request.nextUrl.pathname);

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    // Preserve where the user was headed (e.g. /save?url=...) so login can return them there
    const next = request.nextUrl.pathname + request.nextUrl.search;
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  // Check MFA requirement for authenticated users accessing protected routes
  if (user && isProtectedRoute) {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // nextLevel is aal2 exactly when the user has a verified factor
    if (
      data &&
      isMfaChallengePending({
        currentLevel: data.currentLevel,
        hasVerifiedFactor: data.nextLevel === "aal2",
      })
    ) {
      // User has MFA enabled but hasn't completed the challenge — preserve
      // the original destination (e.g. /save?url=...) across verification
      const next = request.nextUrl.pathname + request.nextUrl.search;
      const url = request.nextUrl.clone();
      url.pathname = "/login/verify-mfa";
      url.search = "";
      url.searchParams.set("next", next);
      return NextResponse.redirect(url);
    }
  }

  // Redirect logged-in users away from auth pages and homepage
  // Exception: allow /login/verify-mfa for MFA challenge and /complete-signup for profile completion
  const isAuthRoute =
    (request.nextUrl.pathname.startsWith("/login") &&
      !request.nextUrl.pathname.startsWith("/login/verify-mfa")) ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/join");
  const isCompleteSignupRoute =
    request.nextUrl.pathname.startsWith("/complete-signup");
  const isHomePage = request.nextUrl.pathname === "/";

  // Allow authenticated users to access /complete-signup (for finishing profile setup)
  // but redirect them away from other auth routes
  if (user && (isAuthRoute || isHomePage) && !isCompleteSignupRoute) {
    // Honor a pending ?next= (e.g. an already-signed-in user following a share link)
    const target = getSafeRedirectPath(
      request.nextUrl.searchParams.get("next"),
    );
    const [pathname, query = ""] = target.split("?", 2);
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = query;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
