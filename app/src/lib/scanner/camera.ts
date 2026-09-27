/**
 * Rear camera, preferring ~5MP (4:3, the sensor's native shape): enough for a
 * page to land at ~200dpi without the memory cost of a 12MP frame per capture.
 * Deliberately `ideal`, not `max` — the browser picks the closest mode, and a
 * hard cap risks OverconstrainedError on cameras without a matching mode.
 */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 2560 },
    height: { ideal: 1920 },
  },
};

export type CameraErrorReason = "denied" | "unavailable" | "unsupported";

export const CAMERA_ERROR_MESSAGES: Record<CameraErrorReason, string> = {
  denied:
    "Camera access is blocked. Allow camera access for abode in your browser settings, or import a photo instead.",
  unavailable:
    "No camera is available. Close any other app using it, or import a photo instead.",
  unsupported:
    "This browser can't open the camera. Import a photo of your document instead.",
};

export function cameraErrorReason(error: unknown): CameraErrorReason {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  return "unavailable";
}

export function isCameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/** Whether the track exposes a controllable torch (not in iOS Safari) */
export function supportsTorch(track: {
  getCapabilities?: () => object;
}): boolean {
  if (typeof track.getCapabilities !== "function") return false;
  const capabilities = track.getCapabilities();
  return Reflect.get(capabilities, "torch") === true;
}

export async function setTorch({
  track,
  on,
}: {
  track: MediaStreamTrack;
  on: boolean;
}): Promise<void> {
  // `torch` is a non-standard (but widely supported) constraint missing from lib.dom
  const torch: MediaTrackConstraintSet & { torch: boolean } = { torch: on };
  await track.applyConstraints({ advanced: [torch] });
}
