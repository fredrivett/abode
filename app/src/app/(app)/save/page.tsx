import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { extractSharedUrl } from "@/lib/share-target";
import { SaveHandler } from "./_components/save-handler";

/**
 * Share-sheet entry point: saves a shared URL to the user's items.
 *
 * Targeted by the web app manifest's `share_target` (Android) and the
 * "Save to abode" iOS Shortcut, both of which open `/save?url=...`.
 * Auth is handled by the `(app)` layout guard.
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
  const sharedUrl = extractSharedUrl(await searchParams);
  if (!sharedUrl) redirect(ROUTES.DASHBOARD);

  return <SaveHandler url={sharedUrl} />;
}
