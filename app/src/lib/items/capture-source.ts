import type { CaptureSource } from "@prisma/client";

// The entry points a client may claim an item was saved from, kept as a runtime
// array so request handlers can validate untrusted input before persisting it.
// Deliberately excludes `api`: that is stamped server-side from the credential,
// never taken from the request body.
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
