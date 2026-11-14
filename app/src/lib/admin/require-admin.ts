import { redirect } from "next/navigation";
import { cache } from "react";
import { checkAdminAccess } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Gate for admin pages: resolves only for an admin with MFA at aal2, and
 * otherwise redirects (login if signed out, dashboard if not an admin, settings
 * to set up MFA, /admin/verify to step up to aal2).
 *
 * Every admin `page.tsx` awaits this first, in its component and in
 * `generateMetadata`: a layout is not an auth boundary, because Next renders a
 * page without the layouts above it when the client says it already has them.
 * `admin-page-gate.test.ts` fails for a page that doesn't.
 *
 * React `cache` resolves it once per server render however many of the layout,
 * page and metadata ask.
 */
export const requireAdmin = cache(async (): Promise<void> => {
  const access = await checkAdminAccess(await createClient());

  if (!access.userId) redirect("/login");
  if (!access.isAdmin) redirect("/dashboard");
  if (!access.hasMFA) redirect("/settings?setup=mfa");
  if (!access.isAAL2) redirect("/admin/verify");
});
