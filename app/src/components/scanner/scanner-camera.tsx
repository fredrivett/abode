"use client";

import { ImageIcon, X, Zap, ZapOff } from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  CAMERA_ERROR_MESSAGES,
  setTorch,
  supportsTorch,
} from "@/lib/scanner/camera";
import {
  coverTransform,
  mapQuad,
  type Quad,
  quadBounds,
} from "@/lib/scanner/geometry";
import type { ScannerClient } from "@/lib/scanner/scanner-client";
import { cn } from "@/lib/utils";
import { QuadOverlay } from "./quad-overlay";
import { scannerHint } from "./scanner-hint";
import { ShutterButton } from "./shutter-button";
import { useCameraStream } from "./use-camera-stream";
import { useDocumentDetection } from "./use-document-detection";
import { useElementSize } from "./use-element-size";

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CameraCapture {
  frame: ImageData;
  /** Live-detected outline in frame pixels (fallback if re-detection misses) */
  hint: Quad | null;
  /** Where the page sits on screen, so the review can animate from it */
  fromRect: ScreenRect | null;
  mode: "auto" | "manual";
}

interface ScannerCameraProps {
  client: ScannerClient | null;
  ready: boolean;
  /** Camera is on screen and should detect/capture (false while reviewing) */
  active: boolean;
  capturing: boolean;
  auto: boolean;
  onAutoChange: (auto: boolean) => void;
  onCapture: (capture: CameraCapture) => void;
  onImport: (file: File) => void;
  onClose: () => void;
  closeLabel: string;
}

/** Full-screen camera with live page detection, auto-capture and import */
export function ScannerCamera({
  client,
  ready,
  active,
  capturing,
  auto,
  onAutoChange,
  onCapture,
  onImport,
  onClose,
  closeLabel,
}: ScannerCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const camera = useCameraStream(videoRef);
  const viewSize = useElementSize(viewportRef);
  const detecting = active && !capturing && camera.status === "ready";
  const detection = useDocumentDetection({
    videoRef,
    client: ready ? client : null,
    active: detecting,
  });
  const [torchOn, setTorchOn] = useState(false);
  const torchTrack =
    camera.status === "ready" && supportsTorch(camera.track)
      ? camera.track
      : null;

  // Resume the live preview whenever the camera is shown again
  useEffect(() => {
    if (active && !capturing && camera.status === "ready") {
      videoRef.current?.play().catch(() => {});
    }
  }, [active, capturing, camera.status]);

  const toView =
    detection.frame && viewSize
      ? coverTransform({ source: detection.frame, view: viewSize })
      : null;
  const viewQuad =
    detection.quad && toView ? mapQuad(detection.quad, toView) : null;

  const capture = useCallback(
    (mode: CameraCapture["mode"]) => {
      const video = videoRef.current;
      const viewport = viewportRef.current;
      if (!video || !video.videoWidth || capturing) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      video.pause();

      let fromRect: ScreenRect | null = null;
      if (viewQuad && viewport) {
        const bounds = quadBounds(viewQuad);
        const origin = viewport.getBoundingClientRect();
        fromRect = {
          ...bounds,
          x: bounds.x + origin.x,
          y: bounds.y + origin.y,
        };
      }
      onCapture({
        frame: ctx.getImageData(0, 0, canvas.width, canvas.height),
        hint: detection.quad,
        fromRect,
        mode,
      });
    },
    [capturing, detection.quad, onCapture, viewQuad],
  );

  // Auto mode: capture once the page has been held steady long enough
  useEffect(() => {
    if (auto && detecting && detection.lock.status === "locked") {
      capture("auto");
    }
  }, [auto, detecting, detection.lock.status, capture]);

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onImport(file);
  };

  const toggleTorch = async () => {
    if (!torchTrack) return;
    const next = !torchOn;
    await setTorch({ track: torchTrack, on: next }).catch(() => {});
    setTorchOn(next);
  };

  return (
    <div className="relative flex size-full flex-col bg-black text-white">
      <div ref={viewportRef} className="absolute inset-0 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="size-full object-cover"
        />
        {active ? (
          <QuadOverlay
            quad={viewQuad}
            status={detection.lock.status}
            capturing={capturing}
          />
        ) : null}
      </div>

      <div className="relative flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={closeLabel}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <X className="size-6" />
        </Button>
        <Button
          variant="ghost"
          onClick={() => onAutoChange(!auto)}
          aria-pressed={auto}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          {auto ? "Auto" : "Manual"}
        </Button>
      </div>

      <div className="relative flex flex-1 items-start justify-center px-6">
        {camera.status === "error" ? (
          <div className="mt-24 max-w-sm space-y-4 rounded-lg bg-black/70 p-5 text-center">
            <p className="text-sm">{CAMERA_ERROR_MESSAGES[camera.reason]}</p>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon />
              Import a photo
            </Button>
          </div>
        ) : (
          <p
            aria-live="polite"
            className={cn(
              "rounded-full bg-black/60 px-4 py-1.5 text-sm transition-opacity",
              camera.status === "starting" && "opacity-0",
            )}
          >
            {scannerHint({
              ready,
              status: detection.lock.status,
              auto,
              capturing,
            })}
          </p>
        )}
      </div>

      <div className="relative grid grid-cols-3 items-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Import a photo"
            className="size-12 text-white hover:bg-white/10 hover:text-white"
          >
            <ImageIcon className="size-6" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImport}
            className="hidden"
          />
        </div>
        <div className="flex justify-center">
          <ShutterButton
            onClick={() => capture("manual")}
            progress={auto && detecting ? detection.lock.progress : null}
            disabled={camera.status !== "ready" || capturing}
          />
        </div>
        <div className="flex justify-end">
          {torchTrack ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTorch}
              aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
              aria-pressed={torchOn}
              className="size-12 text-white hover:bg-white/10 hover:text-white"
            >
              {torchOn ? (
                <Zap className="size-6" />
              ) : (
                <ZapOff className="size-6" />
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
