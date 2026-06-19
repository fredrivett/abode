import { extractSharedUrl, firstSharedValue } from "@/lib/share-target";
import { SaveHandler } from "./_components/save-handler";
import { ShareFailed } from "./_components/share-failed";

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
  const params = await searchParams;
  const sharedUrl = extractSharedUrl(params);
  if (!sharedUrl) {
    return <ShareFailed rawValue={firstSharedValue(params)} />;
  }

  return <SaveHandler url={sharedUrl} />;
}
