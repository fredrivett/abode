import type { Metadata } from "next";
import { ExtensionDetector } from "@/components/extension/extension-detector";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { requireCompletedSignup } from "@/lib/auth/require-completed-signup";
import { NO_INDEX_ROBOTS } from "@/lib/seo/indexing";

export const metadata: Metadata = { robots: NO_INDEX_ROBOTS };

/**
 * Root layout for authenticated app routes.
 *
 * Sends signed-out or incomplete-signup users away on navigation. It is not what
 * protects the pages: Next can render a page without this layout, so each page
 * awaits requireCompletedSignup itself.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCompletedSignup();

  return (
    <>
      <OfflineBanner />
      {children}
      <ExtensionDetector />
    </>
  );
}
