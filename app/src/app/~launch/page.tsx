import type { Metadata } from "next";
import { DashboardShell } from "@/app/(app)/dashboard/dashboard-shell";
import DashboardLoading from "@/app/(app)/dashboard/loading";
import { DashboardHeaderSkeleton } from "@/components/layout/dashboard-header/skeleton";
import { ROUTES } from "@/lib/routes";
import { NO_INDEX_ROBOTS } from "@/lib/seo/indexing";

export const metadata: Metadata = { robots: NO_INDEX_ROBOTS };

// Waits a frame so the skeleton paints, then swaps in the dashboard; the
// browser keeps the skeleton on screen until the dashboard paints. Offline it
// goes anyway: the service worker answers with the last-loaded dashboard, or
// the offline page
const GO_TO_DASHBOARD = `requestAnimationFrame(function () {
  setTimeout(function () { location.replace(${JSON.stringify(ROUTES.DASHBOARD)}); });
});`;

/**
 * The installed app's start_url (manifest.ts). The service worker precaches
 * it (sw.ts), so a launch paints the dashboard's loading skeleton straight
 * away instead of a blank screen while the dashboard renders on the server.
 * Holds no user data, so it's safe to keep across sign-outs.
 */
export default function LaunchPage() {
  return (
    <>
      <DashboardShell header={<DashboardHeaderSkeleton />}>
        <DashboardLoading />
      </DashboardShell>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, constant-built redirect script */}
      <script dangerouslySetInnerHTML={{ __html: GO_TO_DASHBOARD }} />
    </>
  );
}
