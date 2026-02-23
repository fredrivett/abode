"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hexToLab, rgbToLab } from "@/lib/search/color-utils";

type ColorHighlightOverlayProps = {
  imageUrl: string;
  hoveredColorHex: string | null;
  className?: string;
};

type LabColor = { l: number; a: number; b: number };

type CachedImageData = {
  width: number;
  height: number;
  labPixels: LabColor[];
};

// Fixed configuration values
const ANALYSIS_SIZE = 1000;
const MAX_DELTA_E = 45;
const MAX_OPACITY = 0.85;
const TRANSITION_MS = 200;

function deltaEFromLab(lab1: LabColor, lab2: LabColor): number {
  const dL = lab1.l - lab2.l;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Canvas overlay that darkens image pixels dissimilar to a hovered color.
 *
 * Preloads and caches pixel data in LAB color space. When `hoveredColorHex`
 * changes, renders a new mask and crossfades between two canvas layers to
 * avoid flickering.
 */
export function ColorHighlightOverlay({
  imageUrl,
  hoveredColorHex,
  className,
}: ColorHighlightOverlayProps) {
  // Two canvas layers for crossfade effect
  const canvasARef = useRef<HTMLCanvasElement>(null);
  const canvasBRef = useRef<HTMLCanvasElement>(null);
  const [cachedData, setCachedData] = useState<CachedImageData | null>(null);
  // Track which canvas is currently "active" (showing) - 'A' or 'B'
  const activeCanvasRef = useRef<"A" | "B">("A");
  const [canvasAVisible, setCanvasAVisible] = useState(false);
  const [canvasBVisible, setCanvasBVisible] = useState(false);
  // Track the last rendered color to know if we need to crossfade
  const lastRenderedColorRef = useRef<string | null>(null);

  // Load and cache image pixel data on mount/url change
  useEffect(() => {
    if (!imageUrl) {
      setCachedData(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      // Calculate scaled dimensions (fit within ANALYSIS_SIZE)
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      let width: number;
      let height: number;

      if (aspectRatio > 1) {
        width = Math.min(ANALYSIS_SIZE, img.naturalWidth);
        height = Math.round(width / aspectRatio);
      } else {
        height = Math.min(ANALYSIS_SIZE, img.naturalHeight);
        width = Math.round(height * aspectRatio);
      }

      // Create off-screen canvas and draw scaled image
      const offscreen = document.createElement("canvas");
      offscreen.width = width;
      offscreen.height = height;
      const ctx = offscreen.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, width, height);

      // Get pixel data and convert to LAB
      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;
      const labPixels: LabColor[] = [];

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        labPixels.push(rgbToLab({ r, g, b }));
      }

      setCachedData({ width, height, labPixels });
    };

    img.onerror = () => {
      setCachedData(null);
    };

    img.src = imageUrl;
  }, [imageUrl]);

  // Helper function to render mask to a canvas
  const renderMaskToCanvas = useCallback(
    (canvas: HTMLCanvasElement, targetColorHex: string): boolean => {
      if (!cachedData) return false;

      const targetLab = hexToLab(targetColorHex);
      if (!targetLab) return false;

      const { width, height, labPixels } = cachedData;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return false;

      // Create mask image data
      const maskData = ctx.createImageData(width, height);
      const mask = maskData.data;

      for (let i = 0; i < labPixels.length; i++) {
        const pixelLab = labPixels[i];
        const delta = deltaEFromLab(pixelLab, targetLab);

        // Continuous gradient: opacity increases with color distance
        const normalizedDelta = Math.min(delta / MAX_DELTA_E, 1);
        const pixelIndex = i * 4;

        // Black overlay with gradient opacity
        const opacity = normalizedDelta * MAX_OPACITY;
        mask[pixelIndex] = 0; // R
        mask[pixelIndex + 1] = 0; // G
        mask[pixelIndex + 2] = 0; // B
        mask[pixelIndex + 3] = Math.round(opacity * 255); // A
      }

      ctx.putImageData(maskData, 0, 0);
      return true;
    },
    [cachedData],
  );

  // Generate mask when hovering over a color
  useEffect(() => {
    const canvasA = canvasARef.current;
    const canvasB = canvasBRef.current;

    if (!canvasA || !canvasB || !cachedData) {
      setCanvasAVisible(false);
      setCanvasBVisible(false);
      lastRenderedColorRef.current = null;
      return;
    }

    // If no color is hovered, fade out both canvases
    if (!hoveredColorHex) {
      setCanvasAVisible(false);
      setCanvasBVisible(false);
      lastRenderedColorRef.current = null;
      return;
    }

    const targetLab = hexToLab(hoveredColorHex);
    if (!targetLab) {
      return;
    }

    const currentActive = activeCanvasRef.current;

    // If this is the first color (coming from no color), render to active canvas and show it
    if (!lastRenderedColorRef.current) {
      const activeCanvas = currentActive === "A" ? canvasA : canvasB;
      renderMaskToCanvas(activeCanvas, hoveredColorHex);
      if (currentActive === "A") {
        setCanvasAVisible(true);
        setCanvasBVisible(false);
      } else {
        setCanvasAVisible(false);
        setCanvasBVisible(true);
      }
    } else {
      // Crossfade: render to inactive canvas, then swap visibility
      const inactiveCanvas = currentActive === "A" ? canvasB : canvasA;
      const success = renderMaskToCanvas(inactiveCanvas, hoveredColorHex);

      if (!success) {
        return;
      }

      // Toggle which canvas is active
      const newActive = currentActive === "A" ? "B" : "A";
      activeCanvasRef.current = newActive;

      // Crossfade: show new canvas, hide old
      if (newActive === "A") {
        setCanvasAVisible(true);
        setCanvasBVisible(false);
      } else {
        setCanvasAVisible(false);
        setCanvasBVisible(true);
      }
    }

    lastRenderedColorRef.current = hoveredColorHex;
  }, [cachedData, hoveredColorHex, renderMaskToCanvas]);

  if (!cachedData) return null;

  const canvasStyle = (isCanvasVisible: boolean): React.CSSProperties => ({
    opacity: isCanvasVisible ? 1 : 0,
    imageRendering: "auto",
    transitionDuration: `${TRANSITION_MS}ms`,
  });

  return (
    <>
      <canvas
        ref={canvasARef}
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity ease-out ${className ?? ""}`}
        style={canvasStyle(canvasAVisible)}
      />
      <canvas
        ref={canvasBRef}
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity ease-out ${className ?? ""}`}
        style={canvasStyle(canvasBVisible)}
      />
    </>
  );
}
