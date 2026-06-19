import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSafeRedirectPath } from "@/lib/url-utils";

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
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/settings") ||
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/save");

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
    if (data && data.currentLevel === "aal1" && data.nextLevel === "aal2") {
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
