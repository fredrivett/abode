"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { createLogger } from "@/lib/logger.client";
import {
  type Quad,
  type Size,
  scaleQuad,
  smoothQuad,
} from "@/lib/scanner/geometry";
import { createLockTracker, type LockState } from "@/lib/scanner/lock-tracker";
import { DETECTION_FRAME_MAX_DIMENSION } from "@/lib/scanner/protocol";
import type { ScannerClient } from "@/lib/scanner/scanner-client";

const log = createLogger("scanner/use-document-detection");

/** Floor between detection runs, so an idle scanner doesn't spin the CPU */
const MIN_DETECTION_INTERVAL_MS = 80;
/** Weight of each new detection in the displayed outline (lower = steadier) */
const OUTLINE_SMOOTHING = 0.5;

export interface DetectionState {
  /** Smoothed page outline in video pixels, or null when none is in view */
  quad: Quad | null;
  lock: LockState;
  /** Intrinsic video size the quad is relative to */
  frame: Size | null;
}

const IDLE: DetectionState = {
  quad: null,
  lock: { status: "searching", progress: 0 },
  frame: null,
};

/**
 * Continuously detects the document in the camera feed (in the scanner
 * worker) while `active`, and tracks how long it's been held steady.
 */
export function useDocumentDetection({
  videoRef,
  client,
  active,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  client: ScannerClient | null;
  active: boolean;
}): DetectionState {
  const [state, setState] = useState<DetectionState>(IDLE);
  const tracker = useRef(createLockTracker());

  useEffect(() => {
    if (!client || !active) {
      setState(IDLE);
      return;
    }
    tracker.current.reset();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let smoothed: Quad | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = async () => {
      const started = performance.now();
      const video = videoRef.current;
      if (ctx && video && video.readyState >= 2 && video.videoWidth > 0) {
        const frame = { width: video.videoWidth, height: video.videoHeight };
        const scale = Math.min(
          1,
          DETECTION_FRAME_MAX_DIMENSION / Math.max(frame.width, frame.height),
        );
        canvas.width = Math.round(frame.width * scale);
        canvas.height = Math.round(frame.height * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const detection = await client.detect(
            ctx.getImageData(0, 0, canvas.width, canvas.height),
          );
          if (controller.signal.aborted) return;
          const quad = detection.quad
            ? scaleQuad(detection.quad, 1 / scale)
            : null;
          const lock = tracker.current.update({
            quad,
            frame,
            now: performance.now(),
          });
          if (quad) {
            smoothed = smoothed
              ? smoothQuad({
                  previous: smoothed,
                  next: quad,
                  alpha: OUTLINE_SMOOTHING,
                })
              : quad;
          } else if (lock.status === "searching") {
            smoothed = null;
          }
          setState({ quad: smoothed, lock, frame });
        } catch (error) {
          if (controller.signal.aborted) return;
          log.warn({ error }, "Document detection failed");
        }
      }
      const elapsed = performance.now() - started;
      timer = setTimeout(
        tick,
        Math.max(0, MIN_DETECTION_INTERVAL_MS - elapsed),
      );
    };
    void tick();

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [client, active, videoRef]);

  return state;
}
