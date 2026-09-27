import type { ScanFilter } from "./filters";
import { isQuad, type Quad } from "./geometry";
import type { Rotation } from "./warp";

/** Where the worker loads scanic + its ML assets from (see scripts/copy-scanner-assets.ts) */
export const SCANIC_MODULE_PATH = "/vendor/scanic/scanic.js";
export const SCANIC_ML_ASSET_PATH = "/vendor/scanic-ml/";

/** Long edge of the frames sent for live detection (the ML model runs at 224px) */
export const DETECTION_FRAME_MAX_DIMENSION = 480;

/** Long edge of a rendered page — ~200dpi on A4, plenty for reading and OCR */
export const PAGE_MAX_DIMENSION = 2400;

export type Detector = "ml" | "classical";

export interface Detection {
  quad: Quad | null;
  /** ML confidence that a document is present (null for the classical detector) */
  score: number | null;
}

export type ScannerRequest =
  | { type: "init" }
  | { type: "detect"; frame: ImageData }
  | {
      type: "capture";
      frame: ImageData;
      /** Last live detection, scaled to the frame — used if re-detection misses */
      hint: Quad | null;
    }
  | {
      type: "render";
      source: Blob;
      /** Region to flatten; null keeps the whole photo */
      quad: Quad | null;
      rotation: Rotation;
      filter: ScanFilter;
    };

export type ScannerResponse =
  | { type: "init"; detector: Detector }
  | { type: "detect"; detection: Detection }
  | { type: "capture"; source: Blob; quad: Quad | null }
  | { type: "render"; blob: Blob; width: number; height: number };

export type ScannerRequestMessage = ScannerRequest & { id: number };
export type ScannerResponseMessage =
  | (ScannerResponse & { id: number })
  | { type: "error"; id: number; message: string };

function hasNumericId(value: object): boolean {
  return typeof Reflect.get(value, "id") === "number";
}

function isPositiveFinite(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isScannerResponseMessage(
  value: unknown,
): value is ScannerResponseMessage {
  if (typeof value !== "object" || value === null || !hasNumericId(value)) {
    return false;
  }
  switch (Reflect.get(value, "type")) {
    case "init": {
      const detector = Reflect.get(value, "detector");
      return detector === "ml" || detector === "classical";
    }
    case "detect": {
      const detection: unknown = Reflect.get(value, "detection");
      if (typeof detection !== "object" || detection === null) return false;
      const quad: unknown = Reflect.get(detection, "quad");
      const score: unknown = Reflect.get(detection, "score");
      return (
        (quad === null || isQuad(quad)) &&
        (score === null ||
          (typeof score === "number" && Number.isFinite(score)))
      );
    }
    case "capture": {
      const quad: unknown = Reflect.get(value, "quad");
      return (
        Reflect.get(value, "source") instanceof Blob &&
        (quad === null || isQuad(quad))
      );
    }
    case "render":
      return (
        Reflect.get(value, "blob") instanceof Blob &&
        isPositiveFinite(Reflect.get(value, "width")) &&
        isPositiveFinite(Reflect.get(value, "height"))
      );
    case "error":
      return typeof Reflect.get(value, "message") === "string";
    default:
      return false;
  }
}
