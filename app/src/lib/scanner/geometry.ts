/**
 * Geometry helpers for the document scanner. A {@link Quad} is a detected
 * document outline in pixel space (same shape as scanic's `CornerPoints`).
 */

export interface Point {
  x: number;
  y: number;
}

export interface Quad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface Size {
  width: number;
  height: number;
}

export const QUAD_CORNERS = [
  "topLeft",
  "topRight",
  "bottomRight",
  "bottomLeft",
] as const;

export function mapQuad(quad: Quad, fn: (point: Point) => Point): Quad {
  return {
    topLeft: fn(quad.topLeft),
    topRight: fn(quad.topRight),
    bottomRight: fn(quad.bottomRight),
    bottomLeft: fn(quad.bottomLeft),
  };
}

export function scaleQuad(quad: Quad, factor: number): Quad {
  return mapQuad(quad, ({ x, y }) => ({ x: x * factor, y: y * factor }));
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Largest distance any single corner moved between two quads */
export function maxCornerDistance({ from, to }: { from: Quad; to: Quad }) {
  return Math.max(...QUAD_CORNERS.map((key) => distance(from[key], to[key])));
}

/** Shoelace area of the quad, in square pixels */
export function quadArea(quad: Quad): number {
  const points = QUAD_CORNERS.map((key) => quad[key]);
  let twiceArea = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twiceArea) / 2;
}

export function quadBounds(quad: Quad): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const xs = QUAD_CORNERS.map((key) => quad[key].x);
  const ys = QUAD_CORNERS.map((key) => quad[key].y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Output size for flattening a quad: the longer of each pair of opposite
 * sides (so no axis loses resolution), capped so the long edge is at most
 * `maxDimension`.
 */
export function flattenedSize({
  quad,
  maxDimension,
}: {
  quad: Quad;
  maxDimension: number;
}): Size {
  const width = Math.max(
    distance(quad.topLeft, quad.topRight),
    distance(quad.bottomLeft, quad.bottomRight),
  );
  const height = Math.max(
    distance(quad.topLeft, quad.bottomLeft),
    distance(quad.topRight, quad.bottomRight),
  );
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Maps a point in source (video frame) pixels to an element rendering that
 * source with `object-fit: cover`, i.e. scaled to fill and center-cropped.
 */
export function coverTransform({
  source,
  view,
}: {
  source: Size;
  view: Size;
}): (point: Point) => Point {
  const scale = Math.max(
    view.width / source.width,
    view.height / source.height,
  );
  const offsetX = (view.width - source.width * scale) / 2;
  const offsetY = (view.height - source.height * scale) / 2;
  return ({ x, y }) => ({ x: x * scale + offsetX, y: y * scale + offsetY });
}

/**
 * Exponential moving average between two quads, used to steady the live
 * outline. `alpha` is the weight of the new sample (1 = no smoothing).
 */
export function smoothQuad({
  previous,
  next,
  alpha,
}: {
  previous: Quad;
  next: Quad;
  alpha: number;
}): Quad {
  const blend = (a: Point, b: Point): Point => ({
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha,
  });
  return {
    topLeft: blend(previous.topLeft, next.topLeft),
    topRight: blend(previous.topRight, next.topRight),
    bottomRight: blend(previous.bottomRight, next.bottomRight),
    bottomLeft: blend(previous.bottomLeft, next.bottomLeft),
  };
}

export function isQuad(value: unknown): value is Quad {
  if (typeof value !== "object" || value === null) return false;
  return QUAD_CORNERS.every((key) => {
    const point: unknown = Reflect.get(value, key);
    return (
      typeof point === "object" &&
      point !== null &&
      Number.isFinite(Reflect.get(point, "x")) &&
      Number.isFinite(Reflect.get(point, "y"))
    );
  });
}
