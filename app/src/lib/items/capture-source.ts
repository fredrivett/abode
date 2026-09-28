import type { CaptureSource } from "@prisma/client";
import type { AuthenticatedRequest } from "@/lib/auth/authenticate-request";

// The entry points a client may claim an item was saved from, kept as a runtime
// array so request handlers can validate untrusted input before persisting it.
// Deliberately excludes `api`: that's stamped server-side from the credential
// (see captureAttribution), never taken from the request body.
const VALID_ITEM_SOURCES = [
  "web",
  "share_target",
  "extension",
] as const satisfies readonly CaptureSource[];

export type ItemSource = (typeof VALID_ITEM_SOURCES)[number];

export function isItemSource(value: unknown): value is ItemSource {
  return (
    typeof value === "string" &&
    VALID_ITEM_SOURCES.includes(value as ItemSource)
  );
}

// User-facing labels for the Details panel. "web" covers pasting a link,
// uploading, and composing in-app — all done from the web app.
const CAPTURE_SOURCE_LABELS: Record<CaptureSource, string> = {
  web: "Web",
  share_target: "Shared",
  extension: "Extension",
  api: "API",
};

export function captureSourceLabel(source: CaptureSource): string {
  return CAPTURE_SOURCE_LABELS[source];
}

export type CaptureAttribution = {
  captureSource: CaptureSource;
  /** The token that saved the item, or null for any non-token entry point */
  personalAccessTokenId: string | null;
};

/**
 * Where a new item came from, decided by the credential rather than trusted
 * from the client: a personal-access-token save is always `api` and records the
 * token, whatever the body claims. Sessions keep their self-reported source
 * (in-app vs extension), falling back to `web`.
 */
export function captureAttribution(
  auth: AuthenticatedRequest,
  clientSource: unknown,
): CaptureAttribution {
  if (auth.method === "pat") {
    return { captureSource: "api", personalAccessTokenId: auth.tokenId };
  }
  return {
    captureSource: isItemSource(clientSource) ? clientSource : "web",
    personalAccessTokenId: null,
  };
}
