import type { LockStatus } from "@/lib/scanner/lock-tracker";

/** Guidance shown over the camera for the current detection state */
export function scannerHint({
  ready,
  status,
  auto,
  capturing,
}: {
  ready: boolean;
  status: LockStatus;
  auto: boolean;
  capturing: boolean;
}): string {
  if (capturing) return "Capturing…";
  if (!ready) return "Getting ready…";
  if (status === "searching") return "Point the camera at a document";
  if (status === "too-small") return "Move closer";
  return auto ? "Hold steady" : "Tap to capture";
}
