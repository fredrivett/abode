import { redirect } from "next/navigation";
import { createLogger } from "@/lib/logger.server";
import { getPostHogClient } from "@/lib/posthog-server";
import { ROUTES } from "@/lib/routes";
import { extractSharedUrl, firstSharedValue } from "@/lib/share-target";
import { createClient } from "@/lib/supabase/server";
import { SaveRedirect } from "./_components/save-redirect";

const log = createLogger("save");

/**
 * Share-sheet entry point. Saves a shared URL (via an invisible client POST),
 * then lands the user on the dashboard with a toast (`?share=`) — no dedicated
 * full-screen view.
 *
 * Targeted by the web app manifest's `share_target` (Android) and the
 * "Save link to abode" iOS Shortcut, both of which open `/save?url=...`.
 * Auth is enforced by the `(app)` layout guard.
 */
export default async function SavePage({
  searchParams,
}: {
  searchParams: Promise<{
    url?: string | string[];
    text?: string | string[];
    title?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const sharedUrl = extractSharedUrl(params);

  // The save itself runs client-side (POST), so a prefetched/refreshed GET of
  // this page can't create duplicate items.
  if (sharedUrl) {
    return <SaveRedirect url={sharedUrl} />;
  }

  // No parseable link — surface it on the dashboard rather than save silently.
  const received = firstSharedValue(params);
  log.warn({ received }, "Share target opened without a parseable URL");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    getPostHogClient()?.capture({
      distinctId: user.id,
      event: "share_target_failed",
      properties: { reason: "no_url", received: received?.slice(0, 200) },
    });
  }

  redirect(`${ROUTES.DASHBOARD}?share=no_link`);
}
