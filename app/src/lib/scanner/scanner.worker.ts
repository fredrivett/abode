/// <reference lib="webworker" />
/**
 * Document scanner worker: live edge detection, capture and page rendering,
 * kept off the main thread so the camera preview stays smooth.
 *
 * scanic is loaded at runtime from our own origin rather than bundled — its
 * ML chunk is pulled in by a relative `import()` that bundlers can't follow
 * (see scripts/copy-scanner-assets.ts).
 */
import { applyScanFilter } from "./filters";
import { flattenedSize, isQuad, type Quad } from "./geometry";
import {
  type Detection,
  type Detector,
  PAGE_MAX_DIMENSION,
  SCANIC_ML_ASSET_PATH,
  SCANIC_MODULE_PATH,
  type ScannerRequestMessage,
  type ScannerResponse,
  type ScannerResponseMessage,
} from "./protocol";
import { type Pixels, rotatePixels, warpPerspective } from "./warp";

declare const self: DedicatedWorkerGlobalScope;

type ScanicModule = typeof import("scanic");

interface MlDetectorModule {
  initializeMl(options: object): Promise<void>;
  detectDocumentMl(
    image: ImageData,
    options: object,
  ): Promise<{ success: boolean; corners: unknown; score: number | null }>;
}

const absolute = (path: string) => new URL(path, self.location.origin).href;
const mlOptions = { assetBaseUrl: absolute(SCANIC_ML_ASSET_PATH) };

let scanic: ScanicModule | null = null;
let ml: MlDetectorModule | null = null;
let ready: Promise<Detector> | null = null;

async function load(): Promise<Detector> {
  scanic = await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ absolute(
      SCANIC_MODULE_PATH,
    )
  );
  try {
    const mlModule: MlDetectorModule = await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ absolute(
        SCANIC_MODULE_PATH.replace("scanic.js", "scanic-mlDetector.js"),
      )
    );
    await mlModule.initializeMl(mlOptions);
    ml = mlModule;
    return "ml";
  } catch {
    // The ML runtime/model failed to load — the classical detector still works
    return "classical";
  }
}

function init(): Promise<Detector> {
  ready ??= load();
  return ready;
}

async function detect(frame: ImageData): Promise<Detection> {
  await init();
  if (ml) {
    const result = await ml.detectDocumentMl(frame, mlOptions);
    return {
      quad: result.success && isQuad(result.corners) ? result.corners : null,
      score: result.score,
    };
  }
  if (!scanic) throw new Error("scanic failed to load");
  const result = await scanic.scanDocument(frame, {
    mode: "detect",
    maxProcessingDimension: 800,
  });
  return {
    quad: result.success && isQuad(result.corners) ? result.corners : null,
    score: null,
  };
}

function toCanvas(pixels: Pixels): OffscreenCanvas {
  const canvas = new OffscreenCanvas(pixels.width, pixels.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable in worker");
  ctx.putImageData(
    new ImageData(pixels.data, pixels.width, pixels.height),
    0,
    0,
  );
  return canvas;
}

async function decode(blob: Blob): Promise<Pixels> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable in worker");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function handle(
  request: ScannerRequestMessage,
): Promise<ScannerResponse> {
  switch (request.type) {
    case "init":
      return { type: "init", detector: await init() };
    case "detect":
      return { type: "detect", detection: await detect(request.frame) };
    case "capture": {
      // Re-detect on the full-resolution frame for the most precise corners
      const { quad } = await detect(request.frame);
      const source = await toCanvas(request.frame).convertToBlob({
        type: "image/jpeg",
        quality: 0.92,
      });
      return { type: "capture", source, quad: quad ?? request.hint };
    }
    case "render": {
      const source = await decode(request.source);
      const quad: Quad = request.quad ?? {
        topLeft: { x: 0, y: 0 },
        topRight: { x: source.width - 1, y: 0 },
        bottomRight: { x: source.width - 1, y: source.height - 1 },
        bottomLeft: { x: 0, y: source.height - 1 },
      };
      const flat = warpPerspective({
        source,
        quad,
        size: flattenedSize({ quad, maxDimension: PAGE_MAX_DIMENSION }),
      });
      const rotated = rotatePixels({
        source: flat,
        rotation: request.rotation,
      });
      const filtered = applyScanFilter({
        pixels: rotated,
        filter: request.filter,
      });
      const blob = await toCanvas(filtered).convertToBlob({
        type: "image/jpeg",
        quality: 0.9,
      });
      return {
        type: "render",
        blob,
        width: filtered.width,
        height: filtered.height,
      };
    }
  }
}

self.addEventListener("message", (event: MessageEvent) => {
  const request: ScannerRequestMessage = event.data;
  handle(request).then(
    (response) => {
      const message: ScannerResponseMessage = { ...response, id: request.id };
      self.postMessage(message);
    },
    (error: unknown) => {
      const message: ScannerResponseMessage = {
        type: "error",
        id: request.id,
        message: error instanceof Error ? error.message : String(error),
      };
      self.postMessage(message);
    },
  );
});
