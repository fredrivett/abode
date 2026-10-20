/**
 * The 3D hardback (BookCover3D) projected to flat geometry, for renderers
 * without 3D transforms (next/og's satori). A rotateY under CSS perspective
 * keeps vertical lines vertical and scales each one uniformly about the
 * perspective origin, so the turned cover can be drawn exactly as thin
 * vertical slices, each shifted and scaled by its own depth.
 */

/** BookCover3D's 3D setup, as fractions of the book's width */
export const BOOK_3D = {
  /** CSS perspective distance (470cqw) */
  perspective: 4.7,
  /** The front cover is hinged at the spine and turned toward the viewer */
  coverAngle: 28,
  /** Page block plane: starts at 84% across, 26% wide, turned away */
  pagesLeft: 0.84,
  pagesWidth: 0.26,
  pagesAngle: 58,
  pagesInsetY: 0.015,
} as const;

type Point = [x: number, y: number];

/**
 * One vertical slice of a turned plane: the flat column `[from, from + width)`
 * (px across the plane), its exact on-screen outline (`quad`, clockwise from
 * top-left, in the book's box), and the affine that maps the flat column into
 * it: scale by `scaleX`/`scaleY`, then move to `left`/`top`.
 */
export type BookSlice = {
  from: number;
  width: number;
  quad: [Point, Point, Point, Point];
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Project a point on a plane through `originX`, turned by `angle` about the
 * vertical axis (positive turns toward the viewer), at distance `u` along it.
 * Returns screen x and the vertical scale at that point.
 */
function project({
  width,
  originX,
  angle,
  u,
}: {
  width: number;
  originX: number;
  angle: number;
  u: number;
}) {
  const d = BOOK_3D.perspective * width;
  const x = originX + u * Math.cos(toRad(angle));
  const z = u * Math.sin(toRad(angle));
  const scale = d / (d - z);
  // Perspective origin is the box's centre
  return { x: width / 2 + (x - width / 2) * scale, scale };
}

function slices({
  width,
  height,
  originX,
  planeWidth,
  angle,
  insetY,
  step,
}: {
  width: number;
  height: number;
  originX: number;
  planeWidth: number;
  angle: number;
  insetY: number;
  step: number;
}): BookSlice[] {
  const halfHeight = (height * (1 - 2 * insetY)) / 2;
  const count = Math.ceil(planeWidth / step);
  const at = (u: number) => project({ width, originX, angle, u });
  return Array.from({ length: count }, (_, i) => {
    const from = i * step;
    const sliceWidth = Math.min(step, planeWidth - from);
    const start = at(from);
    const end = at(from + sliceWidth);
    const scaleY = at(from + sliceWidth / 2).scale;
    const y = (scale: number, side: 1 | -1) =>
      height / 2 + side * halfHeight * scale;
    return {
      from,
      width: sliceWidth,
      quad: [
        [start.x, y(start.scale, -1)],
        [end.x, y(end.scale, -1)],
        [end.x, y(end.scale, 1)],
        [start.x, y(start.scale, 1)],
      ],
      left: start.x,
      // The flat plane is drawn at the full box height, scaled about its top
      top: (height * (1 - scaleY)) / 2,
      scaleX: (end.x - start.x) / sliceWidth,
      scaleY,
    };
  });
}

/** The outline of a whole sliced plane, clockwise from top-left. */
export function planeOutline(planeSlices: BookSlice[]): Point[] {
  const first = planeSlices[0];
  const last = planeSlices[planeSlices.length - 1];
  return [first.quad[0], last.quad[1], last.quad[2], first.quad[3]];
}

/**
 * The front cover, turned open toward the viewer: slices left to right,
 * growing taller toward the fore-edge. Each shows `step` px of the flat cover.
 */
export function coverSlices({
  width,
  height,
  step = 4,
}: {
  width: number;
  height: number;
  step?: number;
}): BookSlice[] {
  return slices({
    width,
    height,
    originX: 0,
    planeWidth: width,
    angle: BOOK_3D.coverAngle,
    insetY: 0,
    step,
  });
}

/** The page block's fore-edge, receding from behind the cover. */
export function pageSlices({
  width,
  height,
  step = 3,
}: {
  width: number;
  height: number;
  step?: number;
}): BookSlice[] {
  return slices({
    width,
    height,
    originX: BOOK_3D.pagesLeft * width,
    planeWidth: BOOK_3D.pagesWidth * width,
    angle: -BOOK_3D.pagesAngle,
    insetY: BOOK_3D.pagesInsetY,
    step,
  });
}

/** How far the turned cover overhangs the box, above and below. */
export function coverOverhang(height: number): number {
  const fore = project({
    width: 1,
    originX: 0,
    angle: BOOK_3D.coverAngle,
    u: 1,
  });
  return (height * (fore.scale - 1)) / 2;
}
