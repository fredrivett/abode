import type { Point, Quad, Size } from "./geometry";

/** Minimal RGBA pixel buffer — structurally compatible with `ImageData` */
export interface Pixels {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

export function createPixels({ width, height }: Size): Pixels {
  return { data: new Uint8ClampedArray(width * height * 4), width, height };
}

/** Solves the 8x8 linear system `a·x = b` by Gaussian elimination with partial pivoting */
function solveLinearSystem(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) {
      throw new Error("Degenerate quad: points are collinear");
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col] / m[col][col];
      for (let k = col; k <= n; k++) m[row][k] -= factor * m[col][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

/**
 * Homography mapping each `from` point onto its `to` point, as the 8
 * coefficients [a..h] of x' = (ax + by + c) / (gx + hy + 1),
 * y' = (dx + ey + f) / (gx + hy + 1).
 */
export function homography({
  from,
  to,
}: {
  from: readonly Point[];
  to: readonly Point[];
}): number[] {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    a.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  return solveLinearSystem(a, b);
}

/**
 * Flattens the `quad` region of `source` into an upright `size` rectangle
 * (perspective correction), sampling bilinearly. Maps each output pixel back
 * into the source, so there are no holes or seams.
 */
export function warpPerspective({
  source,
  quad,
  size,
}: {
  source: Pixels;
  quad: Quad;
  size: Size;
}): Pixels {
  const { width, height } = size;
  const [a, b, c, d, e, f, g, h] = homography({
    from: [
      { x: 0, y: 0 },
      { x: width - 1, y: 0 },
      { x: width - 1, y: height - 1 },
      { x: 0, y: height - 1 },
    ],
    to: [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft],
  });

  const out = createPixels(size);
  const dst = out.data;
  const src = source.data;
  const srcWidth = source.width;
  const maxX = source.width - 1;
  const maxY = source.height - 1;

  for (let oy = 0; oy < height; oy++) {
    for (let ox = 0; ox < width; ox++) {
      const w = g * ox + h * oy + 1;
      let sx = (a * ox + b * oy + c) / w;
      let sy = (d * ox + e * oy + f) / w;
      sx = sx < 0 ? 0 : sx > maxX ? maxX : sx;
      sy = sy < 0 ? 0 : sy > maxY ? maxY : sy;

      const x0 = sx | 0;
      const y0 = sy | 0;
      const x1 = x0 < maxX ? x0 + 1 : x0;
      const y1 = y0 < maxY ? y0 + 1 : y0;
      const fx = sx - x0;
      const fy = sy - y0;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const i00 = (y0 * srcWidth + x0) * 4;
      const i10 = (y0 * srcWidth + x1) * 4;
      const i01 = (y1 * srcWidth + x0) * 4;
      const i11 = (y1 * srcWidth + x1) * 4;
      const di = (oy * width + ox) * 4;
      for (let ch = 0; ch < 3; ch++) {
        dst[di + ch] =
          src[i00 + ch] * w00 +
          src[i10 + ch] * w10 +
          src[i01 + ch] * w01 +
          src[i11 + ch] * w11;
      }
      dst[di + 3] = 255;
    }
  }
  return out;
}

export type Rotation = 0 | 90 | 180 | 270;

/** Rotates pixels clockwise by a multiple of 90° */
export function rotatePixels({
  source,
  rotation,
}: {
  source: Pixels;
  rotation: Rotation;
}): Pixels {
  if (rotation === 0) return source;
  const { width, height, data } = source;
  const swap = rotation !== 180;
  const out = createPixels(
    swap ? { width: height, height: width } : { width, height },
  );
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let tx: number;
      let ty: number;
      if (rotation === 90) {
        tx = height - 1 - y;
        ty = x;
      } else if (rotation === 180) {
        tx = width - 1 - x;
        ty = height - 1 - y;
      } else {
        tx = y;
        ty = width - 1 - x;
      }
      const si = (y * width + x) * 4;
      const di = (ty * out.width + tx) * 4;
      out.data[di] = data[si];
      out.data[di + 1] = data[si + 1];
      out.data[di + 2] = data[si + 2];
      out.data[di + 3] = data[si + 3];
    }
  }
  return out;
}
