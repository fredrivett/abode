import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExtensionDetector } from "@/components/extension/extension-detector";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { hasCompletedSignup } from "@/lib/auth/has-completed-signup";
import { ROUTES } from "@/lib/routes";
import { NO_INDEX_ROBOTS } from "@/lib/seo/indexing";
import { getRequestUserWithMfa } from "@/lib/supabase/server";

export const metadata: Metadata = { robots: NO_INDEX_ROBOTS };

/**
 * Root layout for authenticated app routes.
 *
 * Verifies the user is authenticated and has completed signup (has a username).
 * Redirects to `/login` or `/complete-signup` as needed.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    data: { user },
  } = await getRequestUserWithMfa();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  const signupComplete = await hasCompletedSignup(user.id);
  if (!signupComplete) {
    redirect(ROUTES.COMPLETE_SIGNUP);
  }

  return (
    <>
      <OfflineBanner />
      {children}
      <ExtensionDetector />
    </>
  );
}
