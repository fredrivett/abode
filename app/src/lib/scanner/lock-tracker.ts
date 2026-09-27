import { maxCornerDistance, type Quad, quadArea, type Size } from "./geometry";

/** How long a document must be held steady before auto mode captures it */
export const AUTO_CAPTURE_HOLD_MS = 5000;

export type LockStatus =
  /** No document in view */
  | "searching"
  /** A document is in view but too small to scan well */
  | "too-small"
  /** Document held steady; `progress` counts up to auto-capture */
  | "steady"
  /** Held steady for the full hold time — auto mode should capture now */
  | "locked";

export interface LockState {
  status: LockStatus;
  /** 0..1 progress through the hold time (0 unless steady/locked) */
  progress: number;
}

export interface LockTrackerOptions {
  holdMs?: number;
  /** Max corner movement from the anchor, as a fraction of the frame diagonal */
  tolerance?: number;
  /** Min fraction of the frame the document must cover */
  minCoverage?: number;
  /** Missed detections shorter than this don't break the lock (detector flicker) */
  graceMs?: number;
}

/**
 * Tracks whether a detected document has been held steady long enough to
 * auto-capture. Feed it every detection result (or `null` when nothing was
 * found). Stability is measured against the quad where the current steady
 * period started, so slow drift eventually resets it rather than creeping.
 */
export function createLockTracker({
  holdMs = AUTO_CAPTURE_HOLD_MS,
  tolerance = 0.03,
  minCoverage = 0.1,
  graceMs = 400,
}: LockTrackerOptions = {}) {
  let anchor: Quad | null = null;
  let steadySince = 0;
  let lastSeenAt = Number.NEGATIVE_INFINITY;
  let lastState: LockState = { status: "searching", progress: 0 };

  const reset = () => {
    anchor = null;
    steadySince = 0;
    lastSeenAt = Number.NEGATIVE_INFINITY;
    lastState = { status: "searching", progress: 0 };
  };

  const update = ({
    quad,
    frame,
    now,
  }: {
    quad: Quad | null;
    frame: Size;
    now: number;
  }): LockState => {
    if (!quad) {
      if (anchor && now - lastSeenAt <= graceMs) return lastState;
      reset();
      return lastState;
    }

    // Detections paused longer than the grace period (e.g. a stalled worker):
    // the old hold no longer proves the page stayed steady, so start afresh
    if (anchor && now - lastSeenAt > graceMs) anchor = null;
    lastSeenAt = now;
    const frameArea = frame.width * frame.height;
    if (quadArea(quad) / frameArea < minCoverage) {
      anchor = null;
      lastState = { status: "too-small", progress: 0 };
      return lastState;
    }

    const diagonal = Math.hypot(frame.width, frame.height);
    if (
      !anchor ||
      maxCornerDistance({ from: anchor, to: quad }) > tolerance * diagonal
    ) {
      anchor = quad;
      steadySince = now;
    }

    const progress = Math.min(1, (now - steadySince) / holdMs);
    lastState = { status: progress >= 1 ? "locked" : "steady", progress };
    return lastState;
  };

  return { update, reset };
}

export type LockTracker = ReturnType<typeof createLockTracker>;
