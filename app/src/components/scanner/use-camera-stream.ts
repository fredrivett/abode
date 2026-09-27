"use client";

import { type RefObject, useEffect, useState } from "react";
import {
  CAMERA_CONSTRAINTS,
  type CameraErrorReason,
  cameraErrorReason,
  isCameraSupported,
} from "@/lib/scanner/camera";

export type CameraStream =
  | { status: "starting" }
  | { status: "ready"; track: MediaStreamTrack }
  | { status: "error"; reason: CameraErrorReason };

/** Opens the rear camera into `videoRef` for the lifetime of the component */
export function useCameraStream(
  videoRef: RefObject<HTMLVideoElement | null>,
): CameraStream {
  const [camera, setCamera] = useState<CameraStream>({ status: "starting" });

  useEffect(() => {
    if (!isCameraSupported()) {
      setCamera({ status: "error", reason: "unsupported" });
      return;
    }
    let stream: MediaStream | null = null;
    const controller = new AbortController();

    navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS).then(
      async (opened) => {
        stream = opened;
        const video = videoRef.current;
        if (controller.signal.aborted || !video) {
          for (const track of opened.getTracks()) track.stop();
          return;
        }
        video.srcObject = opened;
        try {
          await video.play();
        } catch {
          // Autoplay can reject if the element was paused/detached mid-start; the stream is still live
        }
        const [track] = opened.getVideoTracks();
        if (controller.signal.aborted || !track) return;
        // The camera was unplugged, revoked or grabbed by another app; `ended`
        // doesn't fire for our own stop() on unmount
        track.addEventListener(
          "ended",
          () => setCamera({ status: "error", reason: "unavailable" }),
          { signal: controller.signal },
        );
        setCamera({ status: "ready", track });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setCamera({ status: "error", reason: cameraErrorReason(error) });
        }
      },
    );

    return () => {
      controller.abort();
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [videoRef]);

  return camera;
}
