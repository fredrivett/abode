import type { CaptureSource } from "@prisma/client";

// The entry point an item was saved from. Mirrors the Prisma `CaptureSource`
// enum; kept as a runtime array so request handlers can validate untrusted
// client input before persisting it.
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
};

export function captureSourceLabel(source: CaptureSource): string {
  return CAPTURE_SOURCE_LABELS[source];
}
